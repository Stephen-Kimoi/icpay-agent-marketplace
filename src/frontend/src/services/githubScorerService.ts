import { backend } from "../../../declarations/backend";

export interface GitHubScorerParams {
  githubHandle: string;
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
  if (!githubHandle.trim()) {
    throw new Error("GitHub handle cannot be empty");
  }

  // Remove @ if present
  const handle = githubHandle.trim().replace(/^@/, "");

  if (!handle.match(/^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/)) {
    throw new Error("Invalid GitHub handle format");
  }

  // TODO: Replace with actual backend call when ready
  // const result = await backend.score_github(handle);
  // if ("Ok" in result) {
  //   return result.Ok;
  // }
  // throw new Error(result.Err);

  // Placeholder implementation for now
  // This will be replaced with actual backend integration
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        score: 85,
        rank: 42,
        totalUsers: 1000,
        breakdown: {
          commits: 25,
          activity: 20,
          languages: 15,
          repositories: 15,
          contributions: 10,
        },
        details: `## GitHub Score Analysis for @${handle}\n\n### Overall Score: 85/100\n\n**Rank**: #42 out of 1,000 users\n\n### Score Breakdown:\n\n- **Commits**: 25 points\n  - Active commit history with consistent contributions\n\n- **Activity**: 20 points\n  - Regular activity across multiple repositories\n\n- **Languages**: 15 points\n  - Diverse technology stack with 8+ languages\n\n- **Repositories**: 15 points\n  - Well-maintained repositories with good documentation\n\n- **Contributions**: 10 points\n  - Active participation in open source projects\n\n### Recommendations:\n\n1. Increase commit frequency for higher activity score\n2. Contribute to more open source projects\n3. Maintain consistent activity across all repositories`,
      });
    }, 2000);
  });
};

