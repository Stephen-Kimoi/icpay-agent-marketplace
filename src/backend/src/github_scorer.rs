use candid::{CandidType, Deserialize};
use ic_llm::Model;
use serde_json::Value;
use std::collections::HashMap;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GitHubMetrics {
    pub total_commits: u64,
    pub repositories: u64,
    pub languages: HashMap<String, u64>, // Language -> bytes of code
    pub contributions_last_year: u64,
    pub stars_received: u64,
    pub forks_received: u64,
    pub pull_requests: u64,
    pub issues_opened: u64,
    pub followers: u64,
    pub account_age_days: u64,
    pub public_repos: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GitHubScoreResult {
    pub score: f64,
    pub rank: u64,
    pub total_users: u64,
    pub breakdown: ScoreBreakdown,
    pub details: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ScoreBreakdown {
    pub commits: f64,
    pub activity: f64,
    pub languages: f64,
    pub repositories: f64,
    pub contributions: f64,
}

pub struct GitHubScorer;

impl GitHubScorer {
    /// Calculate GitHub score using LLM based on metrics
    pub async fn calculate_score(
        metrics: &GitHubMetrics,
        total_users: u64,
    ) -> Result<GitHubScoreResult, String> {
        // Build prompt for LLM to calculate score
        let prompt = Self::build_scoring_prompt(metrics);
        
        ic_cdk::println!("Calculating GitHub score with LLM...");
        
        // Call LLM to calculate score and generate breakdown
        let llm_response = ic_llm::prompt(Model::Qwen3_32B, &prompt).await;
        
        // Parse LLM response to extract score and breakdown
        let (score, breakdown, details) = Self::parse_llm_response(&llm_response, metrics)?;
        
        // Calculate rank (simplified - in production, you'd query stored scores)
        let rank = Self::calculate_rank(score, total_users);
        
        Ok(GitHubScoreResult {
            score,
            rank,
            total_users,
            breakdown,
            details,
        })
    }

    fn build_scoring_prompt(metrics: &GitHubMetrics) -> String {
        let languages_summary: String = metrics
            .languages
            .iter()
            .map(|(lang, bytes)| format!("{}: {} bytes", lang, bytes))
            .collect::<Vec<_>>()
            .join(", ");

        format!(
            r#"You are an expert at evaluating GitHub developer profiles. Calculate a comprehensive score (0-100) based on the following metrics:

**GitHub Profile Metrics:**
- Total Commits: {}
- Public Repositories: {}
- Languages Used: {} ({} languages)
- Contributions Last Year: {}
- Stars Received: {}
- Forks Received: {}
- Pull Requests: {}
- Issues Opened: {}
- Followers: {}
- Account Age: {} days

**Scoring Criteria (Total: 100 points):**
1. **Commits (25 points)**: Based on total commits and consistency
2. **Activity (20 points)**: Based on recent contributions and engagement
3. **Languages (15 points)**: Based on language diversity and usage
4. **Repositories (15 points)**: Based on repository count and quality indicators
5. **Contributions (10 points)**: Based on PRs, issues, and community engagement
6. **Additional Factors (15 points)**: Stars, forks, followers, account maturity

**Instructions:**
1. Calculate a score from 0-100 based on the metrics above
2. Provide a breakdown showing points for each category (commits, activity, languages, repositories, contributions)
3. Generate a detailed markdown analysis explaining the score

**Response Format (JSON):**
{{
  "score": <number 0-100>,
  "breakdown": {{
    "commits": <number 0-25>,
    "activity": <number 0-20>,
    "languages": <number 0-15>,
    "repositories": <number 0-15>,
    "contributions": <number 0-10>
  }},
  "details": "<markdown formatted detailed analysis>"
}}

Calculate the score now:"#,
            metrics.total_commits,
            metrics.public_repos,
            languages_summary,
            metrics.languages.len(),
            metrics.contributions_last_year,
            metrics.stars_received,
            metrics.forks_received,
            metrics.pull_requests,
            metrics.issues_opened,
            metrics.followers,
            metrics.account_age_days
        )
    }

    fn parse_llm_response(
        response: &str,
        metrics: &GitHubMetrics,
    ) -> Result<(f64, ScoreBreakdown, String), String> {
        // Try to extract JSON from LLM response
        let json_start = response.find('{');
        let json_end = response.rfind('}');
        
        if let (Some(start), Some(end)) = (json_start, json_end) {
            let json_str = &response[start..=end];
            
            match serde_json::from_str::<Value>(json_str) {
                Ok(json) => {
                    let score = json
                        .get("score")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0)
                        .clamp(0.0, 100.0);
                    
                    let breakdown_obj = json
                        .get("breakdown")
                        .and_then(|v| v.as_object())
                        .ok_or_else(|| "Missing breakdown in LLM response".to_string())?;
                    
                    let breakdown = ScoreBreakdown {
                        commits: breakdown_obj
                            .get("commits")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0),
                        activity: breakdown_obj
                            .get("activity")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0),
                        languages: breakdown_obj
                            .get("languages")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0),
                        repositories: breakdown_obj
                            .get("repositories")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0),
                        contributions: breakdown_obj
                            .get("contributions")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0),
                    };
                    
                    let details = json
                        .get("details")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    
                    // If details is empty, generate a default one
                    let details = if details.is_empty() {
                        Self::generate_default_details(score, &breakdown, metrics)
                    } else {
                        details
                    };
                    
                    Ok((score, breakdown, details))
                }
                Err(e) => {
                    ic_cdk::println!("Failed to parse LLM JSON response: {}", e);
                    // Fallback to default scoring
                    Self::fallback_scoring(metrics)
                }
            }
        } else {
            // No JSON found, use fallback scoring
            ic_cdk::println!("No JSON found in LLM response, using fallback");
            Self::fallback_scoring(metrics)
        }
    }

    fn fallback_scoring(metrics: &GitHubMetrics) -> Result<(f64, ScoreBreakdown, String), String> {
        // Simple fallback scoring algorithm
        let commits_score = (metrics.total_commits.min(10000) as f64 / 10000.0 * 25.0).min(25.0);
        let activity_score = (metrics.contributions_last_year.min(365) as f64 / 365.0 * 20.0).min(20.0);
        let languages_score = (metrics.languages.len().min(10) as f64 / 10.0 * 15.0).min(15.0);
        let repos_score = (metrics.public_repos.min(50) as f64 / 50.0 * 15.0).min(15.0);
        let contributions_score = ((metrics.pull_requests + metrics.issues_opened).min(100) as f64 / 100.0 * 10.0).min(10.0);
        
        let total_score = commits_score + activity_score + languages_score + repos_score + contributions_score;
        
        let breakdown = ScoreBreakdown {
            commits: commits_score,
            activity: activity_score,
            languages: languages_score,
            repositories: repos_score,
            contributions: contributions_score,
        };
        
        let details = Self::generate_default_details(total_score, &breakdown, metrics);
        
        Ok((total_score, breakdown, details))
    }

    fn generate_default_details(
        score: f64,
        breakdown: &ScoreBreakdown,
        metrics: &GitHubMetrics,
    ) -> String {
        format!(
            r#"## GitHub Score Analysis

### Overall Score: {:.0}/100

### Score Breakdown:

- **Commits**: {:.1} points
  - Total commits: {}
  - Active commit history with consistent contributions

- **Activity**: {:.1} points
  - Contributions last year: {}
  - Regular activity across repositories

- **Languages**: {:.1} points
  - Languages used: {}
  - Diverse technology stack

- **Repositories**: {:.1} points
  - Public repositories: {}
  - Well-maintained codebase

- **Contributions**: {:.1} points
  - Pull requests: {}
  - Issues opened: {}
  - Active participation in open source

### Additional Metrics:
- Stars received: {}
- Forks received: {}
- Followers: {}
- Account age: {} days

### Recommendations:
1. Increase commit frequency for higher activity score
2. Contribute to more open source projects
3. Maintain consistent activity across all repositories
4. Engage more with the community through PRs and issues"#,
            score,
            breakdown.commits,
            metrics.total_commits,
            breakdown.activity,
            metrics.contributions_last_year,
            breakdown.languages,
            metrics.languages.len(),
            breakdown.repositories,
            metrics.public_repos,
            breakdown.contributions,
            metrics.pull_requests,
            metrics.issues_opened,
            metrics.stars_received,
            metrics.forks_received,
            metrics.followers,
            metrics.account_age_days
        )
    }

    fn calculate_rank(score: f64, total_users: u64) -> u64 {
        // Simplified ranking - assumes uniform distribution
        // In production, you'd query the actual rank from stored scores
        if total_users == 0 {
            return 1;
        }
        
        // Estimate rank based on score percentile
        // Higher score = lower rank number (better)
        let percentile = score / 100.0;
        let estimated_rank = ((1.0 - percentile) * total_users as f64).max(1.0) as u64;
        
        estimated_rank.min(total_users)
    }
}

