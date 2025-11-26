use candid::{CandidType, Deserialize};
use ic_llm::Model;
use std::cell::RefCell;
use std::collections::HashMap;

mod pdf;
use pdf::PdfCompressor;

mod text_summarizer;
use text_summarizer::{TextSummarizer, SummarizationOptions};

mod csv_analyzer;
use csv_analyzer::{CsvAnalyzer, AnalysisOptions};

mod github_oauth;
use github_oauth::{
    generate_authorization_url, exchange_code_for_token, get_token, has_token, revoke_token,
    set_github_oauth_config_internal, GitHubOAuthConfig, OAuthAuthorizationUrl, OAuthToken,
    transform_github_oauth,
};
use ic_cdk::api::management_canister::http_request::{HttpResponse, TransformArgs};

mod github_api;
use github_api::{fetch_github_metrics, get_authenticated_user, transform_github_api};

mod github_scorer;
use github_scorer::{GitHubScorer, GitHubScoreResult};

mod github_ranking;
use github_ranking::{GitHubRanking, LeaderboardEntry};

// Types for the API
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Quote {
    pub price: f64,
    pub currency: String,
    pub job_id: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PaymentRequest {
    pub job_id: String,
    pub amount: f64,
    pub currency: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum PaymentStatus {
    Pending,
    Completed,
    Failed,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PaymentInfo {
    pub job_id: String,
    pub status: PaymentStatus,
    pub transaction_id: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct JobRequest {
    pub request: String,
    pub price: f64,
    pub created_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct JobResult {
    pub job_id: String,
    pub output: String,
    pub completed_at: u64,
}

// State management
thread_local! {
    static JOBS: RefCell<HashMap<String, JobRequest>> = RefCell::default();
    static PAYMENTS: RefCell<HashMap<String, PaymentInfo>> = RefCell::default();
    static RESULTS: RefCell<HashMap<String, JobResult>> = RefCell::default();
    static JOB_COUNTER: RefCell<u64> = RefCell::new(0);
    static PDF_UPLOADS: RefCell<HashMap<String, Vec<u8>>> = RefCell::default();
    static GITHUB_RANKINGS: RefCell<HashMap<String, GitHubScoreResult>> = RefCell::default();
    static RANKING_COUNTER: RefCell<u64> = RefCell::new(0);
}

// Calculate the cost based on request complexity using AI
async fn calculate_cost(request: &str) -> f64 {
    let request_lower = request.to_lowercase();
    
    // Detect request type
    let is_summarization = request_lower.contains("summarize");
    let is_csv_analysis = request_lower.contains("csv") || request_lower.contains("analyze") && (request_lower.contains("dataset") || request_lower.contains("spreadsheet"));
    
    let (min_price, max_price, default_price) = if is_summarization {
        (0.1, 0.5, 0.3) // Text summarization: 0.1 - 0.5 ICP
    } else if is_csv_analysis {
        (0.2, 1.0, 0.5) // CSV analysis: 0.2 - 1.0 ICP
    } else {
        (0.1, 2.0, 0.5) // Other requests: 0.1 - 2.0 ICP
    };
    
    let prompt = format!(
        "Evaluate this request and determine a fair price for processing it. Consider the complexity, length, and computational requirements.\n\nIMPORTANT: Respond with ONLY a single decimal number between {} and {}. Do not include any text, explanation, or other characters. Just the number.\n\nRequest: {}\n\nPrice:",
        min_price, max_price, request
    );
    
    ic_cdk::println!("Sending request to LLM: {}", prompt);
    let response = ic_llm::prompt(Model::Qwen3_32B, &prompt).await;
    ic_cdk::println!("LLM response: {}", response);
    
    // Parse the response directly as a float
    let cleaned = response.trim();
    ic_cdk::println!("Cleaned response: {}", cleaned);

    match cleaned.parse::<f64>() {
        Ok(price) if price >= min_price && price <= max_price => {
            ic_cdk::println!("Price {} is within valid range ({}-{})", price, min_price, max_price);
            // Round to 2 decimal places
            (price * 100.0).round() / 100.0
        }
        Ok(price) => {
            // Price out of range, clamp to valid range
            ic_cdk::println!("Price {} out of range, clamping to {}-{}", price, min_price, max_price);
            if price < min_price {
                min_price
            } else {
                max_price
            }
        }
        Err(_) => {
            // Fallback to default price if parsing fails
            ic_cdk::println!("Failed to parse price from LLM response: {}", response);
            default_price
        }
    }
}

fn generate_job_id() -> String {
    let counter = JOB_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        *counter += 1;
        *counter
    });
    format!("job_{:016}", counter)
}

/// Compress a PDF with the provided quality (1-100).
#[ic_cdk::update]
fn compress_pdf(pdf_bytes: Vec<u8>, quality: u8) -> Result<Vec<u8>, String> {
    let quality = quality.clamp(1, 100);
    let compressor = PdfCompressor::new(quality);
    compressor.compress(pdf_bytes)
}

/// Summarize text with the provided tone and options.
#[ic_cdk::update]
async fn summarize_text(
    text: String,
    tone: String,
    include_quotes: bool,
) -> Result<String, String> {
    let options = SummarizationOptions::new(tone, include_quotes);
    let summarizer = TextSummarizer::new(options);
    summarizer.summarize(&text).await
}

/// Analyze CSV data with the provided options.
#[ic_cdk::update]
async fn analyze_csv(
    csv_bytes: Vec<u8>,
    preset: String,
    primary_metric: Option<String>,
    segment_column: Option<String>,
    include_visuals: bool,
) -> Result<String, String> {
    let options = AnalysisOptions::new(
        preset,
        primary_metric,
        segment_column,
        include_visuals,
    );
    let analyzer = CsvAnalyzer::new(options);
    analyzer.analyze(&csv_bytes).await
}

/// Get a quote for processing a request
#[ic_cdk::update]
async fn get_quote(request: String) -> Result<Quote, String> {
    ic_cdk::println!("Getting quote for request: {}", request);
    if request.trim().is_empty() {
        ic_cdk::println!("Request cannot be empty");
        return Err("Request cannot be empty".to_string());
    }

    let price = calculate_cost(&request).await;
    ic_cdk::println!("Price: {}", price);
    let job_id = generate_job_id();
    ic_cdk::println!("Job ID: {}", job_id);
    
    // Store the job request
    let job_request = JobRequest {
        request: request.clone(),
        price,
        created_at: ic_cdk::api::time(),
    };

    JOBS.with(|jobs| {
        jobs.borrow_mut().insert(job_id.clone(), job_request);
    });

    Ok(Quote {
        price,
        currency: "ICP".to_string(),
        job_id,
    })
}

/// Initiate payment for a job
#[ic_cdk::update]
async fn initiate_payment(job_id: String) -> Result<PaymentRequest, String> {
    // Check if job exists
    let job = JOBS.with(|jobs| {
        jobs.borrow().get(&job_id).cloned()
    });

    let job = job.ok_or_else(|| "Job not found".to_string())?;

    // Check if payment already exists
    let payment_exists = PAYMENTS.with(|payments| {
        payments.borrow().contains_key(&job_id)
    });

    if payment_exists {
        return Err("Payment already initiated for this job".to_string());
    }

    // Create payment request
    let payment_info = PaymentInfo {
        job_id: job_id.clone(),
        status: PaymentStatus::Pending,
        transaction_id: None,
    };

    PAYMENTS.with(|payments| {
        payments.borrow_mut().insert(job_id.clone(), payment_info);
    });

    Ok(PaymentRequest {
        job_id,
        amount: job.price,
        currency: "ICP".to_string(),
    })
}

/// Check payment status for a job
#[ic_cdk::query]
fn check_payment_status(job_id: String) -> Result<PaymentInfo, String> {
    PAYMENTS.with(|payments| {
        payments.borrow()
            .get(&job_id)
            .cloned()
            .ok_or_else(|| "Payment not found".to_string())
    })
}

/// Complete payment (mock function - in production this would be called by ICPAY SDK callback)
#[ic_cdk::update]
async fn complete_payment(job_id: String, transaction_id: String) -> Result<(), String> {
    PAYMENTS.with(|payments| {
        let mut payments_mut = payments.borrow_mut();
        if let Some(payment) = payments_mut.get_mut(&job_id) {
            payment.status = PaymentStatus::Completed;
            payment.transaction_id = Some(transaction_id);
            Ok(())
        } else {
            Err("Payment not found".to_string())
        }
    })
}

/// Execute the job after payment is confirmed
#[ic_cdk::update]
async fn execute_job(job_id: String) -> Result<JobResult, String> {
    // Check if payment is completed
    let payment = PAYMENTS.with(|payments| {
        payments.borrow()
            .get(&job_id)
            .cloned()
    });

    let payment = payment.ok_or_else(|| "Payment not found".to_string())?;

    match payment.status {
        PaymentStatus::Completed => {
            // Payment is confirmed, proceed with execution
        }
        PaymentStatus::Pending => {
            return Err("Payment not yet completed. Please wait for payment confirmation.".to_string());
        }
        PaymentStatus::Failed => {
            return Err("Payment failed".to_string());
        }
    }

    // Check if job already executed
    let result_exists = RESULTS.with(|results| {
        results.borrow().contains_key(&job_id)
    });

    if result_exists {
        return Err("Job already executed".to_string());
    }

    // Get the job request
    let job = JOBS.with(|jobs| {
        jobs.borrow().get(&job_id).cloned()
    });

    let job = job.ok_or_else(|| "Job not found".to_string())?;

    // Execute using LLM canister
    let output = ic_llm::prompt(Model::Qwen3_32B, &job.request).await;

    // Store the result
    let result = JobResult {
        job_id: job_id.clone(),
        output,
        completed_at: ic_cdk::api::time(),
    };

    RESULTS.with(|results| {
        results.borrow_mut().insert(job_id.clone(), result.clone());
    });

    Ok(result)
}

/// Get job result
#[ic_cdk::query]
fn get_job_result(job_id: String) -> Result<JobResult, String> {
    RESULTS.with(|results| {
        results.borrow()
            .get(&job_id)
            .cloned()
            .ok_or_else(|| "Job result not found".to_string())
    })
}

/// Get all jobs (for debugging/admin)
#[ic_cdk::query]
fn list_jobs() -> Vec<(String, JobRequest)> {
    JOBS.with(|jobs| {
        jobs.borrow().iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    })
}

// ========== GitHub OAuth Functions ==========

/// Generate GitHub OAuth authorization URL
#[ic_cdk::update]
fn github_oauth_authorize() -> Result<OAuthAuthorizationUrl, String> {
    let principal = ic_cdk::caller().to_text();
    generate_authorization_url(principal)
}

/// Exchange OAuth authorization code for access token
#[ic_cdk::update]
async fn github_oauth_callback(code: String, state: String) -> Result<OAuthToken, String> {
    exchange_code_for_token(code, state).await
}

/// Get stored GitHub OAuth token for the caller
#[ic_cdk::query]
fn github_get_token() -> Result<OAuthToken, String> {
    let principal = ic_cdk::caller().to_text();
    get_token(principal).ok_or_else(|| "No GitHub token found. Please authorize first.".to_string())
}

/// Check if caller has a valid GitHub token
#[ic_cdk::query]
fn github_has_token() -> bool {
    let principal = ic_cdk::caller().to_text();
    has_token(principal)
}

/// Revoke/remove GitHub OAuth token
#[ic_cdk::update]
fn github_revoke_token() -> Result<(), String> {
    let principal = ic_cdk::caller().to_text();
    revoke_token(principal)
}

/// Set GitHub OAuth configuration (admin only)
#[ic_cdk::update]
fn github_oauth_set_config(config: GitHubOAuthConfig) -> Result<String, String> {
    // TODO: Replace with your authorized principal
    // For now, we'll allow any principal to set config (you should restrict this)
    // Example:
    // let caller = ic_cdk::caller();
    // let authorized_principal = Principal::from_text("5mqc2-eelsb-rpsbu-tvroe-paiy3-c4wo3-4xl6q-7nelg-gprk3-rkq46-mqe")
    //     .expect("Invalid authorized principal");
    // 
    // if caller != authorized_principal {
    //     return Err("Unauthorized: Only the authorized principal can update GitHub OAuth configuration".to_string());
    // }
    
    // Validate configuration
    if config.client_id.is_empty() {
        return Err("Client ID cannot be empty".to_string());
    }
    if config.client_secret.is_empty() {
        return Err("Client Secret cannot be empty".to_string());
    }
    if config.redirect_uri.is_empty() {
        return Err("Redirect URI cannot be empty".to_string());
    }
    
    set_github_oauth_config_internal(config);
    Ok("GitHub OAuth configuration updated successfully".to_string())
}

/// Get GitHub OAuth configuration (admin only)
#[ic_cdk::query]
fn github_oauth_get_config() -> Result<GitHubOAuthConfig, String> {
    // TODO: Add authorization check if needed
    github_oauth::get_config()
}

// ========== GitHub Scoring Functions ==========

/// Get authenticated user's GitHub username
#[ic_cdk::update]
async fn github_get_username() -> Result<String, String> {
    let caller = ic_cdk::caller();
    let principal = caller.to_text();
    
    // Get user's GitHub token
    let token = get_token(principal)
        .ok_or_else(|| "GitHub not connected. Please authorize GitHub first.".to_string())?;
    
    // Get username from GitHub API
    let username = get_authenticated_user(&token.access_token).await?;
    
    Ok(username)
}

/// Score a GitHub profile
/// If handle is empty, uses the authenticated user's GitHub username
#[ic_cdk::update]
async fn score_github(handle: String) -> Result<GitHubScoreResult, String> {
    let caller = ic_cdk::caller();
    let principal = caller.to_text();
    
    // Get user's GitHub token
    let token = get_token(principal)
        .ok_or_else(|| "GitHub not connected. Please authorize GitHub first.".to_string())?;
    
    // If handle is empty, get it from the authenticated user
    let handle = if handle.trim().is_empty() {
        // Auto-detect username from OAuth token
        get_authenticated_user(&token.access_token).await?
    } else {
        handle.trim().to_string()
    };
    
    ic_cdk::println!("Scoring GitHub profile for handle: {}", handle);
    
    // Check if user already exists in rankings
    let existing_score = GITHUB_RANKINGS.with(|rankings| {
        let rankings_ref = rankings.borrow();
        GitHubRanking::get_existing_score(&handle, &rankings_ref)
    });
    
    if let Some(existing_result) = existing_score {
        ic_cdk::println!("User {} already ranked with score {:.1}", handle, existing_result.score);
        return Ok(existing_result);
    }
    
    // Fetch GitHub metrics for new user
    let metrics = fetch_github_metrics(&handle, Some(&token.access_token)).await?;
    
    ic_cdk::println!("Fetched GitHub metrics: {} repos, {} commits", 
        metrics.repositories, metrics.total_commits);
    
    // Get current total users count
    let total_users = GITHUB_RANKINGS.with(|rankings| {
        rankings.borrow().len() as u64 + 1 // +1 for the new user
    });
    
    // Calculate score using LLM
    let score_result = GitHubScorer::calculate_score(&metrics, total_users).await?;
    
    // Add to rankings and get updated result with correct rank
    let final_result = GITHUB_RANKINGS.with(|rankings| {
        let mut rankings_mut = rankings.borrow_mut();
        GitHubRanking::add_or_update_score(handle.clone(), score_result, &mut rankings_mut)
    });
    
    ic_cdk::println!("Score calculated: {:.1}/100, rank: #{}", 
        final_result.score, final_result.rank);
    
    Ok(final_result)
}

/// Score a public GitHub profile without requiring OAuth
#[ic_cdk::update]
async fn score_github_public(handle: String) -> Result<GitHubScoreResult, String> {
    let trimmed = handle.trim();
    if trimmed.is_empty() {
        return Err("GitHub handle cannot be empty".to_string());
    }

    ic_cdk::println!("Scoring public GitHub profile for handle: {}", trimmed);
    
    // Check if user already exists in rankings
    let existing_score = GITHUB_RANKINGS.with(|rankings| {
        let rankings_ref = rankings.borrow();
        GitHubRanking::get_existing_score(trimmed, &rankings_ref)
    });
    
    if let Some(existing_result) = existing_score {
        ic_cdk::println!("User {} already ranked with score {:.1}", trimmed, existing_result.score);
        return Ok(existing_result);
    }

    let metrics = fetch_github_metrics(trimmed, None).await?;

    ic_cdk::println!(
        "Fetched public GitHub metrics: {} repos, {} commits",
        metrics.repositories,
        metrics.total_commits
    );

    // Get current total users count
    let total_users = GITHUB_RANKINGS.with(|rankings| {
        rankings.borrow().len() as u64 + 1 // +1 for the new user
    });
    
    let score_result = GitHubScorer::calculate_score(&metrics, total_users).await?;
    
    // Add to rankings and get updated result with correct rank
    let final_result = GITHUB_RANKINGS.with(|rankings| {
        let mut rankings_mut = rankings.borrow_mut();
        GitHubRanking::add_or_update_score(trimmed.to_string(), score_result, &mut rankings_mut)
    });

    ic_cdk::println!(
        "Public score calculated: {:.1}/100, rank: #{}",
        final_result.score,
        final_result.rank
    );

    Ok(final_result)
}

/// Transform function for GitHub OAuth HTTP responses (required for consensus)
/// This must be exported so IC can call it during HTTP outcall processing
#[ic_cdk::query]
fn transform_github_oauth_export(response: TransformArgs) -> HttpResponse {
    transform_github_oauth(response)
}

/// Transform function for GitHub API HTTP responses (required for consensus)
/// This must be exported so IC can call it during HTTP outcall processing
#[ic_cdk::query]
fn transform_github_api_export(response: TransformArgs) -> HttpResponse {
    transform_github_api(response)
}

/// Get the GitHub leaderboard (top N users)
#[ic_cdk::query]
fn get_github_leaderboard(limit: Option<u64>) -> Vec<LeaderboardEntry> {
    GITHUB_RANKINGS.with(|rankings| {
        let rankings_ref = rankings.borrow();
        GitHubRanking::get_leaderboard(&rankings_ref, limit)
    })
}

/// Get GitHub ranking statistics
#[ic_cdk::query]
fn get_github_ranking_stats() -> github_ranking::GitHubRankingStats {
    GITHUB_RANKINGS.with(|rankings| {
        let rankings_ref = rankings.borrow();
        GitHubRanking::get_ranking_stats(&rankings_ref)
    })
}

/// Search for users in the rankings
#[ic_cdk::query]
fn search_github_rankings(query: String, limit: Option<u64>) -> Vec<LeaderboardEntry> {
    if query.trim().is_empty() {
        return Vec::new();
    }
    
    GITHUB_RANKINGS.with(|rankings| {
        let rankings_ref = rankings.borrow();
        GitHubRanking::search_users(&rankings_ref, query.trim(), limit)
    })
}

/// Get a user's percentile ranking
#[ic_cdk::query]
fn get_user_percentile(github_handle: String) -> Option<f64> {
    if github_handle.trim().is_empty() {
        return None;
    }
    
    GITHUB_RANKINGS.with(|rankings| {
        let rankings_ref = rankings.borrow();
        GitHubRanking::get_user_percentile(github_handle.trim(), &rankings_ref)
    })
}

/// Check if a user exists in rankings (for duplicate prevention)
#[ic_cdk::query]
fn user_exists_in_rankings(github_handle: String) -> bool {
    if github_handle.trim().is_empty() {
        return false;
    }
    
    GITHUB_RANKINGS.with(|rankings| {
        let rankings_ref = rankings.borrow();
        GitHubRanking::user_exists(github_handle.trim(), &rankings_ref)
    })
}

/// Get total number of ranked users
#[ic_cdk::query]
fn get_total_ranked_users() -> u64 {
    GITHUB_RANKINGS.with(|rankings| {
        rankings.borrow().len() as u64
    })
}

ic_cdk::export_candid!();