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
    // Verify state exists and hasn't expired
    let oauth_state = OAUTH_STATES.with(|states| {
        states.borrow().get(&state).cloned()
    });
    
    let oauth_state = oauth_state.ok_or_else(|| "Invalid or expired OAuth state".to_string())?;
    
    // Check expiration
    let now = ic_cdk::api::time();
    if now > oauth_state.expires_at {
        // Clean up expired state
        OAUTH_STATES.with(|states| {
            states.borrow_mut().remove(&state);
        });
        return Err("OAuth state has expired".to_string());
    }
    
    // Verify the principal matches
    let caller = ic_cdk::caller().to_text();
    if oauth_state.principal != caller {
        return Err("OAuth state principal mismatch".to_string());
    }
    
    // Exchange code for token via HTTP request
    let token_response = request_access_token(&code).await?;
    
    // Parse the token response
    let access_token = token_response
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing access_token in response".to_string())?
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
    
    // Prepare request body
    let body = format!(
        "client_id={}&client_secret={}&code={}&redirect_uri={}",
        urlencoding::encode(&config.client_id),
        urlencoding::encode(&config.client_secret),
        urlencoding::encode(code),
        urlencoding::encode(&config.redirect_uri)
    );
    
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
            "transform".to_string(),
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
    
    serde_json::from_str::<Value>(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {}", e))
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
#[ic_cdk::query]
pub fn transform(response: TransformArgs) -> HttpResponse {
    response.response
}