import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Github,
} from "lucide-react";
import { githubOAuthCallback } from "@/services/githubOAuthService";

export default function GitHubOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false); // Use ref to prevent race conditions

  useEffect(() => {
    // Prevent duplicate processing (React StrictMode runs effects twice)
    // Use ref instead of state to avoid race conditions
    if (hasProcessedRef.current) {
      console.log("[OAuth Callback] Already processed, skipping duplicate call");
      return;
    }

    const handleCallback = async () => {
      // Mark as processed immediately to prevent race conditions
      hasProcessedRef.current = true;
      console.log("[OAuth Callback] Starting OAuth code exchange");
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Check for OAuth errors from GitHub
      if (errorParam) {
        setError(
          errorDescription || errorParam || "OAuth authorization was denied or failed"
        );
        setStatus("error");
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setError("Missing OAuth code or state parameter");
        setStatus("error");
        return;
      }

      try {
        // Exchange code for access token
        const token = await githubOAuthCallback(code, state);
        
        console.log("OAuth token received:", {
          token_type: token.token_type,
          scope: token.scope,
          user_principal: token.user_principal,
        });

        setStatus("success");
        
        // Redirect to GitHub Scorer page after a short delay
        setTimeout(() => {
          navigate("/agent/github-scorer", { replace: true });
        }, 2000);
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to complete OAuth authentication"
        );
        setStatus("error");
      }
    };

    handleCallback();
    // Empty dependency array - only run once on mount
    // searchParams and navigate are stable and don't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16 sm:px-8">
        <header className="flex flex-col gap-6 rounded-3xl border border-gray-800/60 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-950/90 p-8 backdrop-blur-xl">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-purple-300 transition hover:text-purple-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Marketplace
            </Link>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-gray-800/70 bg-gray-900/70 px-5 py-2 text-sm text-gray-300">
              <Github className="h-4 w-4 text-purple-300" />
              GitHub OAuth Authentication
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Connecting GitHub
              </span>
            </h1>
          </div>
        </header>

        <main className="rounded-3xl border border-gray-800/70 bg-gray-950/60 p-8 backdrop-blur-xl">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  Completing GitHub authentication...
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  Please wait while we exchange your authorization code for an access token.
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <div className="rounded-full bg-green-500/20 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  GitHub Connected Successfully!
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  Redirecting you to the GitHub Scorer...
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <div className="rounded-full bg-red-500/20 p-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  Authentication Failed
                </p>
                <p className="mt-2 text-sm text-red-300">{error}</p>
              </div>
              <div className="mt-6 flex gap-4">
                <Link
                  to="/agent/github-scorer"
                  className="rounded-xl border border-gray-800/70 bg-gray-900/60 px-6 py-3 text-sm font-medium text-gray-300 transition hover:border-purple-500/40 hover:text-purple-200"
                >
                  Go to GitHub Scorer
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-xl border border-purple-500/40 bg-purple-500/20 px-6 py-3 text-sm font-medium text-purple-200 transition hover:bg-purple-500/30"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

