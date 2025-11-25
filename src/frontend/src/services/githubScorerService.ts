import { backend } from "../../../declarations/backend";

export interface GitHubScorerParams {
  githubHandle?: string; // Optional - if not provided, uses authenticated user's GitHub username
}

export interface GitHubScoreResult {
  score: number;
  rank: number;
  totalUsers: number;
  breakdown: {
    commits: number;
    activity: number;
    languages: number;
    repositories: number;
    contributions: number;
  };
  details: string;
}

export const scoreGitHub = async ({
  githubHandle,
}: GitHubScorerParams): Promise<GitHubScoreResult> => {
  // If handle is provided, validate it; otherwise backend will auto-detect from OAuth token
  let handle = "";
  if (githubHandle && githubHandle.trim()) {
    // Remove @ if present
    handle = githubHandle.trim().replace(/^@/, "");

    if (!handle.match(/^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/)) {
      throw new Error("Invalid GitHub handle format");
    }
  }
  // If handle is empty, backend will auto-detect from OAuth token

  // Call backend to score GitHub profile (empty string = auto-detect)
  const result = await backend.score_github(handle);
  if ("Ok" in result) {
    return {
      score: result.Ok.score,
      rank: Number(result.Ok.rank),
      totalUsers: Number(result.Ok.total_users),
      breakdown: {
        commits: result.Ok.breakdown.commits,
        activity: result.Ok.breakdown.activity,
        languages: result.Ok.breakdown.languages,
        repositories: result.Ok.breakdown.repositories,
        contributions: result.Ok.breakdown.contributions,
      },
      details: result.Ok.details,
    };
  }
  throw new Error(result.Err);
};

