use candid::{CandidType, Deserialize};
use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs,
    TransformContext,
};
use serde_json::Value;
use std::cell::RefCell;
use std::collections::HashMap;

// OAuth configuration constants
const GITHUB_AUTH_URL: &str = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
// const GITHUB_API_URL: &str = "https://api.github.com"; // Reserved for future GitHub API calls

// OAuth scopes requested from GitHub
const OAUTH_SCOPES: &str = "read:user,user:email,read:org,repo";

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GitHubOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

impl Default for GitHubOAuthConfig {
    fn default() -> Self {
        Self {
            client_id: "YOUR_GITHUB_CLIENT_ID".to_string(),
            client_secret: "YOUR_GITHUB_CLIENT_SECRET".to_string(),
            redirect_uri: "https://your-canister-id.ic0.app/oauth/github/callback".to_string(),
        }
    }
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct OAuthState {
    pub state: String,
    pub principal: String,
    pub created_at: u64,
    pub expires_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct OAuthToken {
    pub access_token: String,
    pub token_type: String,
    pub scope: String,
    pub user_principal: String,
    pub created_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct OAuthAuthorizationUrl {
    pub url: String,
    pub state: String,
}

// State management
thread_local! {
    static GITHUB_OAUTH_CONFIG: RefCell<Option<GitHubOAuthConfig>> = RefCell::new(None);
    static OAUTH_STATES: RefCell<HashMap<String, OAuthState>> = RefCell::default();
    static OAUTH_TOKENS: RefCell<HashMap<String, OAuthToken>> = RefCell::default();
    static STATE_COUNTER: RefCell<u64> = RefCell::new(0);
    static USED_CODES: RefCell<HashMap<String, u64>> = RefCell::default(); // Track used codes to prevent duplicate exchanges
}

/// Get GitHub OAuth configuration
pub fn get_config() -> Result<GitHubOAuthConfig, String> {
    GITHUB_OAUTH_CONFIG.with(|config| {
        config
            .borrow()
            .clone()
            .ok_or_else(|| "GitHub OAuth configuration not set. Please configure OAuth credentials first.".to_string())
    })
}

/// Set GitHub OAuth configuration (internal)
fn set_github_oauth_config(config: GitHubOAuthConfig) {
    GITHUB_OAUTH_CONFIG.with(|c| {
        *c.borrow_mut() = Some(config);
    });
}

/// Set GitHub OAuth configuration (public for lib.rs)
pub fn set_github_oauth_config_internal(config: GitHubOAuthConfig) {
    set_github_oauth_config(config);
}

/// Generate a unique OAuth state token
fn generate_state() -> String {
    let counter = STATE_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        *counter += 1;
        *counter
    });
    
    let timestamp = ic_cdk::api::time();
    let principal = ic_cdk::caller().to_text();
    
    // Create a unique state string
    format!("{}_{}_{}", principal, timestamp, counter)
}

/// Generate GitHub OAuth authorization URL
pub fn generate_authorization_url(principal: String) -> Result<OAuthAuthorizationUrl, String> {
    let config = get_config()?;
    let state = generate_state();
    
    // Log the redirect_uri being used for debugging
    ic_cdk::println!("Authorization URL - redirect_uri: {}", config.redirect_uri);
    ic_cdk::println!("Authorization URL - client_id: {}", config.client_id);
    
    // State expires in 10 minutes
    let now = ic_cdk::api::time();
    let expires_at = now + (10 * 60 * 1_000_000_000); // 10 minutes in nanoseconds
    
    let oauth_state = OAuthState {
        state: state.clone(),
        principal: principal.clone(),
        created_at: now,
        expires_at,
    };
    
    // Store the state
    OAUTH_STATES.with(|states| {
        states.borrow_mut().insert(state.clone(), oauth_state);
    });
    
    // Build authorization URL
    // IMPORTANT: The redirect_uri here must match EXACTLY (including encoding) what we send in token exchange
    let encoded_redirect_uri_auth = urlencoding::encode(&config.redirect_uri);
    ic_cdk::println!("Authorization URL - redirect_uri (raw): {}", config.redirect_uri);
    ic_cdk::println!("Authorization URL - redirect_uri (encoded): {}", encoded_redirect_uri_auth);
    ic_cdk::println!("Authorization URL - redirect_uri bytes: {:?}", config.redirect_uri.as_bytes());
    
    let params = vec![
        ("client_id", config.client_id.as_str()),
        ("redirect_uri", config.redirect_uri.as_str()),
        ("scope", OAUTH_SCOPES),
        ("state", &state),
        ("response_type", "code"),
    ];
    
    let query_string: String = params
        .iter()
        .map(|(key, value)| format!("{}={}", urlencoding::encode(key), urlencoding::encode(value)))
        .collect::<Vec<_>>()
        .join("&");
    
    let url = format!("{}?{}", GITHUB_AUTH_URL, query_string);
    ic_cdk::println!("Authorization URL (full): {}", url);
    
    Ok(OAuthAuthorizationUrl {
        url,
        state,
    })
}

/// Verify OAuth state and exchange authorization code for access token
pub async fn exchange_code_for_token(
    code: String,
    state: String,
) -> Result<OAuthToken, String> {
    let caller = ic_cdk::caller().to_text();
    let now = ic_cdk::api::time();
    
    // Check if this code has already been used (prevent duplicate exchanges)
    let code_already_used = USED_CODES.with(|codes| {
        codes.borrow().contains_key(&code)
    });
    
    if code_already_used {
        ic_cdk::println!("OAuth code already used, returning existing token if available");
        // If code was already used, try to return existing token
        if let Some(existing_token) = get_token(caller.clone()) {
            return Ok(existing_token);
        }
        return Err("OAuth code has already been used. Please start a new authorization flow.".to_string());
    }
    
    // Verify state exists and hasn't expired
    let oauth_state = OAUTH_STATES.with(|states| {
        states.borrow().get(&state).cloned()
    });
    
    let oauth_state = oauth_state.ok_or_else(|| "Invalid or expired OAuth state".to_string())?;
    
    // Check expiration
    if now > oauth_state.expires_at {
        // Clean up expired state
        OAUTH_STATES.with(|states| {
            states.borrow_mut().remove(&state);
        });
        return Err("OAuth state has expired".to_string());
    }
    
    // Verify the principal matches
    if oauth_state.principal != caller {
        return Err("OAuth state principal mismatch".to_string());
    }
    
    // Mark code as being used (before the request to prevent race conditions)
    USED_CODES.with(|codes| {
        codes.borrow_mut().insert(code.clone(), now);
    });
    
    // Exchange code for token via HTTP request
    let token_response = request_access_token(&code).await?;
    
    // Parse the token response
    ic_cdk::println!("Token response keys: {:?}", token_response.as_object().map(|o| o.keys().collect::<Vec<_>>()));
    
    let access_token = token_response
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            // Provide more detailed error message
            let error_info = if let Some(error) = token_response.get("error") {
                format!("Error: {}", error)
            } else {
                format!("Response: {}", serde_json::to_string(&token_response).unwrap_or_default())
            };
            format!("Missing access_token in response. {}", error_info)
        })?
        .to_string();
    
    let token_type = token_response
        .get("token_type")
        .and_then(|v| v.as_str())
        .unwrap_or("bearer")
        .to_string();
    
    let scope = token_response
        .get("scope")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    let oauth_token = OAuthToken {
        access_token: access_token.clone(),
        token_type,
        scope,
        user_principal: caller.clone(),
        created_at: now,
    };
    
    // Store the token
    OAUTH_TOKENS.with(|tokens| {
        tokens.borrow_mut().insert(caller.clone(), oauth_token.clone());
    });
    
    // Clean up the used state
    OAUTH_STATES.with(|states| {
        states.borrow_mut().remove(&state);
    });
    
    Ok(oauth_token)
}

/// Make HTTP request to exchange authorization code for access token
async fn request_access_token(code: &str) -> Result<Value, String> {
    let config = get_config()?;
    let url = GITHUB_TOKEN_URL.to_string();
    
    // Log the redirect_uri being used for debugging
    ic_cdk::println!("Token exchange - redirect_uri: {}", config.redirect_uri);
    ic_cdk::println!("Token exchange - client_id: {}", config.client_id);
    ic_cdk::println!("Token exchange - code length: {}", code.len());
    ic_cdk::println!("Token exchange - client_secret length: {} (should be 40 for GitHub)", config.client_secret.len());
    
    // Validate client_secret format (GitHub secrets are typically 40 characters)
    if config.client_secret.len() != 40 {
        ic_cdk::println!("WARNING: Client secret length is {}, expected 40. This might cause authentication to fail.", config.client_secret.len());
    }
    
    // Prepare request body - Note: redirect_uri should match EXACTLY what was used in authorization
    // GitHub is very strict about this - it must be identical byte-for-byte
    // IMPORTANT: According to GitHub docs, redirect_uri in POST body should be URL-encoded
    // BUT it must match exactly what was sent in the authorization URL
    let encoded_redirect_uri = urlencoding::encode(&config.redirect_uri);
    
    // Log first few and last few characters of client_secret for verification (without exposing full secret)
    let secret_preview = if config.client_secret.len() >= 8 {
        format!("{}...{}", &config.client_secret[..4], &config.client_secret[config.client_secret.len()-4..])
    } else {
        "***".to_string()
    };
    ic_cdk::println!("Token exchange - client_secret preview: {}", secret_preview);
    
    let body = format!(
        "client_id={}&client_secret={}&code={}&redirect_uri={}",
        urlencoding::encode(&config.client_id),
        urlencoding::encode(&config.client_secret),
        urlencoding::encode(code),
        encoded_redirect_uri
    );
    
    // Log body length for debugging
    ic_cdk::println!("Token exchange - request body length: {} bytes", body.len());
    
    ic_cdk::println!("Token exchange - code: {}", code);
    ic_cdk::println!("Token exchange - redirect_uri (raw): {}", config.redirect_uri);
    ic_cdk::println!("Token exchange - redirect_uri (encoded): {}", encoded_redirect_uri);
    ic_cdk::println!("Token exchange - redirect_uri bytes: {:?}", config.redirect_uri.as_bytes());
    ic_cdk::println!("Token exchange request body (without secret): client_id={}&code={}&redirect_uri={}", 
        config.client_id, code, encoded_redirect_uri);
    
    // Prepare headers
    let headers = vec![
        HttpHeader {
            name: "Accept".to_string(),
            value: "application/json".to_string(),
        },
        HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/x-www-form-urlencoded".to_string(),
        },
    ];
    
    // Create HTTP request
    let request = CanisterHttpRequestArgument {
        url: url.clone(),
        method: HttpMethod::POST,
        headers,
        body: Some(body.as_bytes().to_vec()),
        max_response_bytes: Some(16384),
        transform: Some(TransformContext::from_name(
            "transform_github_oauth".to_string(),
            vec![],
        )),
    };
    
    // Make the HTTP request
    // IC CDK 0.17 http_request requires cycles payment (10 billion cycles)
    let cycles: u128 = 10_000_000_000;
    let (response,): (HttpResponse,) = match http_request(request, cycles).await {
        Ok(result) => result,
        Err((code, message)) => {
            return Err(format!("HTTP request failed: {:?} - {}", code, message));
        }
    };
    
    // Parse JSON response
    let response_body = String::from_utf8(response.body)
        .map_err(|e| format!("Failed to parse response body: {}", e))?;
    
    let status_code = response.status.0.to_string().parse::<u16>()
        .unwrap_or(0);
    
    ic_cdk::println!("GitHub OAuth response status: {}", status_code);
    ic_cdk::println!("GitHub OAuth response body: {}", response_body);
    
    // Check if response indicates an error
    if status_code >= 400 {
        // Try to parse error response
        if let Ok(error_json) = serde_json::from_str::<Value>(&response_body) {
            let error_msg = error_json
                .get("error_description")
                .or_else(|| error_json.get("error"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return Err(format!("GitHub OAuth error: {} (status: {})", error_msg, status_code));
        }
        return Err(format!("GitHub OAuth request failed with status: {}", status_code));
    }
    
    // Parse successful response
    let json_value: Value = serde_json::from_str(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {} - Response body: {}", e, response_body))?;
    
    // Check if response contains an error field (GitHub sometimes returns 200 with error in body)
    if let Some(error) = json_value.get("error") {
        let error_description = json_value
            .get("error_description")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown error");
        
        let error_str = error.as_str().unwrap_or("error");
        
        // Provide helpful error message for common issues
        let helpful_msg = if error_str == "bad_verification_code" {
            format!(
                "{} - {}. Common causes: 1) Redirect URI mismatch (check GitHub OAuth App settings), 2) Code expired (try again), 3) Code already used (don't refresh the page). Redirect URI used: {}",
                error_str, error_description, config.redirect_uri
            )
        } else {
            format!("GitHub OAuth error: {} - {}", error_str, error_description)
        };
        
        return Err(helpful_msg);
    }
    
    Ok(json_value)
}

/// Get stored OAuth token for a principal
pub fn get_token(principal: String) -> Option<OAuthToken> {
    OAUTH_TOKENS.with(|tokens| {
        tokens.borrow().get(&principal).cloned()
    })
}

/// Check if a principal has a valid GitHub token
pub fn has_token(principal: String) -> bool {
    OAUTH_TOKENS.with(|tokens| {
        tokens.borrow().contains_key(&principal)
    })
}

/// Remove OAuth token (for logout/disconnect)
pub fn revoke_token(principal: String) -> Result<(), String> {
    OAUTH_TOKENS.with(|tokens| {
        tokens.borrow_mut().remove(&principal);
    });
    Ok(())
}

/// Clean up expired OAuth states (should be called periodically)
#[allow(dead_code)]
pub fn cleanup_expired_states() {
    let now = ic_cdk::api::time();
    OAUTH_STATES.with(|states| {
        let mut states_mut = states.borrow_mut();
        states_mut.retain(|_, state| state.expires_at > now);
    });
}

/// Transform function for HTTP responses (required by IC)
/// This function must be deterministic - it extracts only the response body
/// and removes non-deterministic headers to ensure consensus across replicas
#[ic_cdk::query]
pub fn transform_github_oauth(response: TransformArgs) -> HttpResponse {
    // Create a deterministic response by only keeping the body
    // and removing headers that might vary between replicas
    HttpResponse {
        status: response.response.status,
        headers: vec![], // Remove headers to ensure determinism
        body: response.response.body,
    }
}