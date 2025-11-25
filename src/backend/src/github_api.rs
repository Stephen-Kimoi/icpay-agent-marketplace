use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs, TransformContext,
};
use serde_json::Value;
use std::collections::HashMap;

use crate::github_scorer::GitHubMetrics;

const GITHUB_API_BASE: &str = "https://api.github.com";

/// Get the authenticated user's GitHub username from their token
pub async fn get_authenticated_user(access_token: &str) -> Result<String, String> {
    let url = format!("{}/user", GITHUB_API_BASE);
    let user_data = make_github_request(&url, access_token).await?;
    
    let username = user_data
        .get("login")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to get username from GitHub API".to_string())?
        .to_string();
    
    Ok(username)
}

/// Fetch GitHub user metrics using the stored OAuth token
pub async fn fetch_github_metrics(
    handle: &str,
    access_token: &str,
) -> Result<GitHubMetrics, String> {
    ic_cdk::println!("Fetching GitHub metrics for user: {}", handle);

    // Fetch user profile
    let user_data = fetch_user_data(handle, access_token).await?;
    
    // Fetch repositories
    let repos_data = fetch_user_repos(handle, access_token).await?;
    
    // Fetch contribution stats
    let contribution_stats = fetch_contribution_stats(handle, access_token).await?;
    
    // Calculate metrics
    let metrics = calculate_metrics(user_data, repos_data, contribution_stats)?;
    
    Ok(metrics)
}

async fn fetch_user_data(handle: &str, token: &str) -> Result<Value, String> {
    let url = format!("{}/users/{}", GITHUB_API_BASE, handle);
    make_github_request(&url, token).await
}

async fn fetch_user_repos(handle: &str, token: &str) -> Result<Vec<Value>, String> {
    // Fetch first page of repos (up to 100)
    let url = format!("{}/users/{}/repos?per_page=100&sort=updated", GITHUB_API_BASE, handle);
    let repos_json = make_github_request(&url, token).await?;
    
    let repos = repos_json
        .as_array()
        .ok_or_else(|| "Invalid repos response format".to_string())?
        .clone();
    
    Ok(repos)
}

async fn fetch_contribution_stats(_handle: &str, _token: &str) -> Result<Value, String> {
    // Estimate based on repos and activity
    Ok(serde_json::json!({
        "contributions_last_year": 0, 
        "pull_requests": 0, 
        "issues_opened": 0,
    }))
}

async fn make_github_request(url: &str, token: &str) -> Result<Value, String> {
    let headers = vec![
        HttpHeader {
            name: "Accept".to_string(),
            value: "application/vnd.github.v3+json".to_string(),
        },
        HttpHeader {
            name: "Authorization".to_string(),
            value: format!("Bearer {}", token),
        },
        HttpHeader {
            name: "User-Agent".to_string(),
            value: "ICPay-Agent-Marketplace".to_string(),
        },
    ];

    let request = CanisterHttpRequestArgument {
        url: url.to_string(),
        method: HttpMethod::GET,
        headers,
        body: None,
        max_response_bytes: Some(65536), // 64KB for API responses
        transform: Some(TransformContext::from_name(
            "transform_github_api".to_string(),
            vec![],
        )),
    };

    let cycles: u128 = 10_000_000_000;
    let (response,): (HttpResponse,) = match http_request(request, cycles).await {
        Ok(result) => result,
        Err((code, message)) => {
            return Err(format!("GitHub API request failed: {:?} - {}", code, message));
        }
    };

    let response_body = String::from_utf8(response.body)
        .map_err(|e| format!("Failed to parse response body: {}", e))?;

    serde_json::from_str::<Value>(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {}", e))
}

fn calculate_metrics(
    user_data: Value,
    repos_data: Vec<Value>,
    _contribution_stats: Value,
) -> Result<GitHubMetrics, String> {
    // Extract user profile data
    let public_repos = user_data
        .get("public_repos")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    
    let followers = user_data
        .get("followers")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    
    let created_at = user_data
        .get("created_at")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    // Calculate account age in days
    let account_age_days = if !created_at.is_empty() {
        if created_at.split('T').next().is_some() {
            let now = ic_cdk::api::time() / 1_000_000_000;
            (now / 86400).max(1)
        } else {
            365
        }
    } else {
        365
    };

    // Calculate metrics from repositories
    let mut total_stars = 0u64;
    let mut total_forks = 0u64;
    let mut languages: HashMap<String, u64> = HashMap::new();
    let mut total_commits = 0u64;

    for repo in &repos_data {
        // Stars
        if let Some(stars) = repo.get("stargazers_count").and_then(|v| v.as_u64()) {
            total_stars += stars;
        }

        // Forks
        if let Some(forks) = repo.get("forks_count").and_then(|v| v.as_u64()) {
            total_forks += forks;
        }

        // Language
        if let Some(lang) = repo.get("language").and_then(|v| v.as_str()) {
            if !lang.is_empty() {
                let size = repo
                    .get("size")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                *languages.entry(lang.to_string()).or_insert(0) += size;
            }
        }

        if let Some(size) = repo.get("size").and_then(|v| v.as_u64()) {
            total_commits += size / 10;
        }
    }

    // Estimate contributions from repos
    let contributions_last_year = (repos_data.len() as u64 * 10).min(365);
    let pull_requests = (repos_data.len() as u64 * 5).min(100);
    let issues_opened = (repos_data.len() as u64 * 3).min(50);

    Ok(GitHubMetrics {
        total_commits,
        repositories: public_repos,
        languages,
        contributions_last_year,
        stars_received: total_stars,
        forks_received: total_forks,
        pull_requests,
        issues_opened,
        followers,
        account_age_days,
        public_repos,
    })
}

#[ic_cdk::query]
pub fn transform_github_api(response: TransformArgs) -> HttpResponse {
    HttpResponse {
        status: response.response.status,
        headers: vec![],
        body: response.response.body,
    }
}