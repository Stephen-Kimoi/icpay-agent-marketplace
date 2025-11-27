use candid::{CandidType, Deserialize};
use std::collections::HashMap;
use crate::github_scorer::GitHubScoreResult;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct LeaderboardEntry {
    pub github_handle: String,
    pub score: f64,
    pub rank: u64,
    pub scored_at: u64, // Timestamp when scored
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GitHubRankingStats {
    pub total_users: u64,
    pub average_score: f64,
    pub highest_score: f64,
    pub lowest_score: f64,
}

pub struct GitHubRanking;

impl GitHubRanking {
    /// Check if a user has already been ranked
    pub fn user_exists(github_handle: &str, rankings: &HashMap<String, GitHubScoreResult>) -> bool {
        rankings.contains_key(&github_handle.to_lowercase())
    }

    /// Get existing score result for a user
    pub fn get_existing_score(
        github_handle: &str, 
        rankings: &HashMap<String, GitHubScoreResult>
    ) -> Option<GitHubScoreResult> {
        rankings.get(&github_handle.to_lowercase()).cloned()
    }

    /// Add or update a user's score in the rankings
    pub fn add_or_update_score(
        github_handle: String,
        score_result: GitHubScoreResult,
        rankings: &mut HashMap<String, GitHubScoreResult>,
    ) -> GitHubScoreResult {
        let handle_key = github_handle.to_lowercase();
        
        // Store the score result
        rankings.insert(handle_key.clone(), score_result.clone());
        
        // Recalculate all ranks based on current scores
        Self::recalculate_ranks(rankings);
        
        // Return the updated score result with correct rank
        rankings.get(&handle_key).unwrap().clone()
    }

    /// Recalculate ranks for all users based on their scores
    fn recalculate_ranks(rankings: &mut HashMap<String, GitHubScoreResult>) {
        // Collect all scores and sort them in descending order
        let mut score_entries: Vec<(String, f64)> = rankings
            .iter()
            .map(|(handle, result)| (handle.clone(), result.score))
            .collect();
        
        // Sort by score (highest first)
        score_entries.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Assign ranks (handle ties by giving same rank)
        let mut current_rank = 1u64;
        let mut previous_score: Option<f64> = None;
        
        for (i, (handle, score)) in score_entries.iter().enumerate() {
            let rank = if let Some(prev_score) = previous_score {
                if (prev_score - score).abs() < 0.1 {
                    // Same score (within 0.1 points), same rank
                    current_rank
                } else {
                    // Different score, new rank
                    (i + 1) as u64
                }
            } else {
                // First entry
                1
            };
            
            current_rank = rank;
            previous_score = Some(*score);
            
            // Update the rank in the stored result
            let total_users = rankings.len() as u64;
            if let Some(result) = rankings.get_mut(handle) {
                result.rank = rank;
                result.total_users = total_users;
            }
        }
    }

    /// Get leaderboard entries (top N users)
    pub fn get_leaderboard(
        rankings: &HashMap<String, GitHubScoreResult>,
        limit: Option<u64>,
    ) -> Vec<LeaderboardEntry> {
        let mut entries: Vec<LeaderboardEntry> = rankings
            .iter()
            .map(|(handle, result)| LeaderboardEntry {
                github_handle: handle.clone(),
                score: result.score,
                rank: result.rank,
                scored_at: ic_cdk::api::time(),
            })
            .collect();

        // Sort by rank (lowest rank number = highest position)
        entries.sort_by(|a, b| a.rank.cmp(&b.rank));

        // Apply limit if specified
        if let Some(limit) = limit {
            entries.truncate(limit as usize);
        }

        entries
    }

    /// Get ranking statistics
    pub fn get_ranking_stats(rankings: &HashMap<String, GitHubScoreResult>) -> GitHubRankingStats {
        if rankings.is_empty() {
            return GitHubRankingStats {
                total_users: 0,
                average_score: 0.0,
                highest_score: 0.0,
                lowest_score: 0.0,
            };
        }

        let scores: Vec<f64> = rankings.values().map(|r| r.score).collect();
        let total_score: f64 = scores.iter().sum();
        let average_score = total_score / scores.len() as f64;
        let highest_score = scores.iter().fold(0.0f64, |a, &b| a.max(b));
        let lowest_score = scores.iter().fold(100.0f64, |a, &b| a.min(b));

        GitHubRankingStats {
            total_users: rankings.len() as u64,
            average_score: (average_score * 10.0).round() / 10.0, // Round to 1 decimal
            highest_score: (highest_score * 10.0).round() / 10.0,
            lowest_score: (lowest_score * 10.0).round() / 10.0,
        }
    }

    /// Search for users by handle (partial match)
    pub fn search_users(
        rankings: &HashMap<String, GitHubScoreResult>,
        query: &str,
        limit: Option<u64>,
    ) -> Vec<LeaderboardEntry> {
        let query_lower = query.to_lowercase();
        
        let mut entries: Vec<LeaderboardEntry> = rankings
            .iter()
            .filter(|(handle, _)| handle.contains(&query_lower))
            .map(|(handle, result)| LeaderboardEntry {
                github_handle: handle.clone(),
                score: result.score,
                rank: result.rank,
                scored_at: ic_cdk::api::time(),
            })
            .collect();

        // Sort by rank
        entries.sort_by(|a, b| a.rank.cmp(&b.rank));

        // Apply limit if specified
        if let Some(limit) = limit {
            entries.truncate(limit as usize);
        }

        entries
    }

    /// Get user's position relative to others (percentile)
    pub fn get_user_percentile(
        github_handle: &str,
        rankings: &HashMap<String, GitHubScoreResult>,
    ) -> Option<f64> {
        let handle_key = github_handle.to_lowercase();
        let user_result = rankings.get(&handle_key)?;
        
        let total_users = rankings.len() as f64;
        let users_below = rankings
            .values()
            .filter(|result| result.score < user_result.score)
            .count() as f64;

        let percentile = (users_below / total_users) * 100.0;
        Some((percentile * 10.0).round() / 10.0) // Round to 1 decimal
    }
}
