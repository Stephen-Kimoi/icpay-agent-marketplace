import { backend } from "../../../declarations/backend";

export interface GitHubOAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface OAuthAuthorizationUrl {
  url: string;
  state: string;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  scope: string;
  user_principal: string;
  created_at: bigint;
}

/// Generate GitHub OAuth authorization URL
export const githubOAuthAuthorize = async (): Promise<OAuthAuthorizationUrl> => {
  const result = await backend.github_oauth_authorize();
  if ("Ok" in result) {
    return result.Ok;
  }
  throw new Error(result.Err);
};

/// Exchange OAuth authorization code for access token
export const githubOAuthCallback = async (
  code: string,
  state: string
): Promise<OAuthToken> => {
  const result = await backend.github_oauth_callback(code, state);
  if ("Ok" in result) {
    return result.Ok;
  }
  throw new Error(result.Err);
};

/// Get stored GitHub OAuth token
export const githubGetToken = async (): Promise<OAuthToken> => {
  const result = await backend.github_get_token();
  if ("Ok" in result) {
    return result.Ok;
  }
  throw new Error(result.Err);
};

/// Check if user has a valid GitHub token
export const githubHasToken = async (): Promise<boolean> => {
  return await backend.github_has_token();
};

/// Revoke GitHub OAuth token
export const githubRevokeToken = async (): Promise<void> => {
  const result = await backend.github_revoke_token();
  if ("Err" in result) {
    throw new Error(result.Err);
  }
};

/// Set GitHub OAuth configuration (admin only)
export const githubOAuthSetConfig = async (
  config: GitHubOAuthConfig
): Promise<string> => {
  const result = await backend.github_oauth_set_config(config);
  if ("Ok" in result) {
    return result.Ok;
  }
  throw new Error(result.Err);
};

/// Get GitHub OAuth configuration
export const githubOAuthGetConfig = async (): Promise<GitHubOAuthConfig> => {
  const result = await backend.github_oauth_get_config();
  if ("Ok" in result) {
    return result.Ok;
  }
  throw new Error(result.Err);
};

