import { backend } from "../../../declarations/backend";

export interface LeaderboardEntry {
  github_handle: string;
  score: number;
  rank: number;
  scored_at: number;
}

export interface GitHubRankingStats {
  total_users: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
}

export const getGitHubLeaderboard = async (limit?: number): Promise<LeaderboardEntry[]> => {
  const result = await backend.get_github_leaderboard(limit ? [BigInt(limit)] : []);
  return result.map(entry => ({
    github_handle: entry.github_handle,
    score: entry.score,
    rank: Number(entry.rank),
    scored_at: Number(entry.scored_at),
  }));
};

export const getGitHubRankingStats = async (): Promise<GitHubRankingStats> => {
  const result = await backend.get_github_ranking_stats();
  return {
    total_users: Number(result.total_users),
    average_score: result.average_score,
    highest_score: result.highest_score,
    lowest_score: result.lowest_score,
  };
};

export const searchGitHubRankings = async (
  query: string,
  limit?: number
): Promise<LeaderboardEntry[]> => {
  const result = await backend.search_github_rankings(
    query,
    limit ? [BigInt(limit)] : []
  );
  return result.map(entry => ({
    github_handle: entry.github_handle,
    score: entry.score,
    rank: Number(entry.rank),
    scored_at: Number(entry.scored_at),
  }));
};

export const getUserPercentile = async (githubHandle: string): Promise<number | null> => {
  const result = await backend.get_user_percentile(githubHandle);
  return result.length > 0 && result[0] !== undefined ? result[0] : null;
};

export const userExistsInRankings = async (githubHandle: string): Promise<boolean> => {
  return await backend.user_exists_in_rankings(githubHandle);
};

export const getTotalRankedUsers = async (): Promise<number> => {
  const result = await backend.get_total_ranked_users();
  return Number(result);
};
