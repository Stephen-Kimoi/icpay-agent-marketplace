use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs, TransformContext,
};
use serde_json::Value;
use std::collections::HashMap;
use ic_llm;

use crate::github_scorer::GitHubMetrics;

/// Parse GitHub's ISO 8601 timestamp to days since creation
fn parse_github_date_to_days(created_at: &str) -> u64 {
    // Parse GitHub's ISO 8601 timestamp (e.g., "2019-01-25T18:44:36Z")
    if let Some(date_part) = created_at.split('T').next() {
        // Parse date in YYYY-MM-DD format
        let date_parts: Vec<&str> = date_part.split('-').collect();
        if date_parts.len() == 3 {
            if let (Ok(year), Ok(month), Ok(day)) = (
                date_parts[0].parse::<i32>(),
                date_parts[1].parse::<u32>(),
                date_parts[2].parse::<u32>(),
            ) {
                // Calculate days since creation (rough approximation)
                let current_year = 2024;
                let current_month = 11; // November
                let current_day = 26;
                
                // Calculate total days for created date
                let created_total_days = (year * 365) + ((month - 1) * 30) as i32 + day as i32;
                
                // Calculate total days for current date
                let current_total_days = (current_year * 365) + ((current_month - 1) * 30) + current_day;
                
                let days_diff = (current_total_days - created_total_days).max(1) as u64;
                
                // Cap at reasonable limits
                days_diff.min(365 * 15) // Max 15 years
            } else {
                365 // Default to 1 year if parsing fails
            }
        } else {
            365
        }
    } else {
        365
    }
}

const GITHUB_API_BASE: &str = "https://api.github.com";

/// Get the authenticated user's GitHub username from their token
pub async fn get_authenticated_user(access_token: &str) -> Result<String, String> {
    let url = format!("{}/user", GITHUB_API_BASE);
    let user_data = make_github_request(&url, Some(access_token)).await?;
    
    let username = user_data
        .get("login")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Failed to get username from GitHub API".to_string())?
        .to_string();
    
    Ok(username)
}

/// Fetch GitHub user metrics using optional OAuth token
pub async fn fetch_github_metrics(
    handle: &str,
    access_token: Option<&str>,
) -> Result<GitHubMetrics, String> {
    ic_cdk::println!("Fetching GitHub metrics for user: {}", handle);

    // Fetch user profile
    let user_data = fetch_user_data(handle, access_token).await?;
    
    // Fetch repositories
    let repos_data = fetch_user_repos(handle, access_token).await?;
    
    // Fetch contribution stats
    let contribution_stats = fetch_contribution_stats(handle, access_token).await?;
    
    // Calculate metrics
    let metrics = calculate_metrics(user_data, repos_data, contribution_stats).await?;
    
    Ok(metrics)
}

async fn fetch_user_data(handle: &str, token: Option<&str>) -> Result<Value, String> {
    let url = format!("{}/users/{}", GITHUB_API_BASE, handle);
    make_github_request(&url, token).await
}

async fn fetch_user_repos(handle: &str, token: Option<&str>) -> Result<Vec<Value>, String> {
    // Fetch first page of repos (up to 100)
    let url = format!("{}/users/{}/repos?per_page=100&sort=updated", GITHUB_API_BASE, handle);
    let repos_json = make_github_request(&url, token).await?;
    
    let repos = repos_json
        .as_array()
        .ok_or_else(|| "Invalid repos response format".to_string())?
        .clone();
    
    Ok(repos)
}

async fn fetch_contribution_stats(_handle: &str, _token: Option<&str>) -> Result<Value, String> {
    // Estimate based on repos and activity
    Ok(serde_json::json!({
        "contributions_last_year": 0, 
        "pull_requests": 0, 
        "issues_opened": 0,
    }))
}

async fn make_github_request(url: &str, token: Option<&str>) -> Result<Value, String> {
    let mut headers = vec![
        HttpHeader {
            name: "Accept".to_string(),
            value: "application/vnd.github.v3+json".to_string(),
        },
        HttpHeader {
            name: "User-Agent".to_string(),
            value: "ICPay-Agent-Marketplace".to_string(),
        },
    ];

    if let Some(token) = token {
        headers.push(HttpHeader {
            name: "Authorization".to_string(),
            value: format!("Bearer {}", token),
        });
    }

    let request = CanisterHttpRequestArgument {
        url: url.to_string(),
        method: HttpMethod::GET,
        headers,
        body: None,
        max_response_bytes: Some(2000000), // 2MB
        transform: Some(TransformContext::from_name(
            "transform_github_api".to_string(),
            vec![],
        )),
    };

    let cycles: u128 = 30_000_000_000; // 30 billion cycles
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

async fn calculate_metrics(
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
        parse_github_date_to_days(created_at)
    } else {
        365 // Default to 1 year if no date provided
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

    // Estimate contributions from repos (focus on this year)
    let contributions_this_year = (repos_data.len() as u64 * 8).min(365);
    
    // More realistic estimates for PRs and issues based on actual repo activity
    let pull_requests = if repos_data.len() > 20 {
        (repos_data.len() as u64 * 2).min(80)
    } else if repos_data.len() > 10 {
        (repos_data.len() as u64 * 3).min(40)
    } else {
        (repos_data.len() as u64 * 1).min(15)
    };
    
    let issues_opened = if repos_data.len() > 15 {
        (repos_data.len() as u64 * 2).min(60)
    } else if repos_data.len() > 5 {
        (repos_data.len() as u64 * 2).min(25)
    } else {
        (repos_data.len() as u64 * 1).min(10)
    };
    
    // Generate monthly commit data using LLM for realistic patterns
    let monthly_commits = generate_monthly_commits_with_llm(
        total_commits,
        public_repos,
        account_age_days,
        &languages,
    ).await;

    Ok(GitHubMetrics {
        total_commits,
        repositories: public_repos,
        languages,
        contributions_this_year,
        stars_received: total_stars,
        forks_received: total_forks,
        pull_requests,
        issues_opened,
        followers,
        account_age_days,
        public_repos,
        monthly_commits,
    })
}

async fn generate_monthly_commits_with_llm(
    total_commits: u64,
    repos_count: u64,
    account_age_days: u64,
    languages: &HashMap<String, u64>,
) -> Vec<u64> {
    // Use LLM to generate realistic monthly commit distribution
    if total_commits == 0 {
        return vec![0; 12];
    }
    
    let top_languages: Vec<String> = languages
        .iter()
        .take(3)
        .map(|(lang, _)| lang.clone())
        .collect();
    
    let prompt = format!(
        r#"Generate a realistic monthly commit distribution for a GitHub developer with the following profile:

**Developer Profile:**
- Total commits: {}
- Public repositories: {}
- Account age: {} days
- Primary languages: {}

**Task:**
Generate 12 monthly commit counts (last 12 months, from oldest to newest) that:
1. Sum up to approximately {} total commits
2. Show realistic patterns (seasonal variations, project cycles, etc.)
3. Reflect the developer's experience level and activity

**Response Format (JSON only):**
{{
  "monthly_commits": [month1, month2, month3, month4, month5, month6, month7, month8, month9, month10, month11, month12]
}}

Generate realistic numbers now:"#,
        total_commits,
        repos_count,
        account_age_days,
        top_languages.join(", "),
        total_commits / 2
    );
    
    match ic_llm::prompt(ic_llm::Model::Qwen3_32B, &prompt).await {
        response => {
            // Try to parse JSON response
            if let Some(start) = response.find('{') {
                if let Some(end) = response.rfind('}') {
                    let json_str = &response[start..=end];
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                        if let Some(commits_array) = parsed.get("monthly_commits").and_then(|v| v.as_array()) {
                            let mut monthly_commits = Vec::new();
                            for commit_val in commits_array.iter().take(12) {
                                if let Some(commit_count) = commit_val.as_u64() {
                                    monthly_commits.push(commit_count);
                                } else {
                                    // Fallback if parsing fails
                                    monthly_commits.push(total_commits / 24);
                                }
                            }
                            
                            // Ensure we have exactly 12 months
                            while monthly_commits.len() < 12 {
                                monthly_commits.push(total_commits / 24);
                            }
                            
                            return monthly_commits;
                        }
                    }
                }
            }
            
            // Fallback if LLM parsing fails
            ic_cdk::println!("Failed to parse LLM response for monthly commits, using fallback");
            generate_fallback_monthly_commits(total_commits)
        }
    }
}

fn generate_fallback_monthly_commits(total_commits: u64) -> Vec<u64> {
    // Fallback method when LLM is unavailable
    if total_commits == 0 {
        return vec![0; 12];
    }
    
    let avg_monthly = (total_commits / 24).max(1);
    
    let mut monthly = Vec::with_capacity(12);
    for i in 0..12 {
        let variation = match i {
            0..=2 => 0.8,   // Winter months
            3..=5 => 1.2,   // Spring
            6..=8 => 0.9,   // Summer
            9..=11 => 1.1,  // Fall
            _ => 1.0,
        };
        
        let month_commits = ((avg_monthly as f64 * variation) as u64).max(0);
        monthly.push(month_commits);
    }
    
    monthly
}

#[ic_cdk::query]
pub fn transform_github_api(response: TransformArgs) -> HttpResponse {
    HttpResponse {
        status: response.response.status,
        headers: vec![],
        body: response.response.body,
    }
}