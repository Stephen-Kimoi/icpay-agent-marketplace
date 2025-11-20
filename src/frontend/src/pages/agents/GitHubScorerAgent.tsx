import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Copy,
  CheckCircle,
  Github,
  Loader2,
  Trophy,
  TrendingUp,
  Users,
  Code2,
  Activity,
  GitBranch,
} from "lucide-react";
import { scoreGitHub, type GitHubScoreResult } from "@/services/githubScorerService";
import { usePaymentFlow } from "@/hooks/usePaymentFlow";
// @ts-ignore - ICPay widget types may not be fully resolved
import { IcpayPayButton } from "@ic-pay/icpay-widget/react";

type ScoringResult = {
  scoreResult: GitHubScoreResult;
};

export default function GitHubScorerAgent() {
  const [githubHandle, setGithubHandle] = useState("");
  const [copied, setCopied] = useState(false);

  const {
    state,
    quote,
    paymentResult,
    result,
    error,
    loading,
    isProcessing,
    icpayConfig,
    requestQuote,
    handlePaymentSuccess,
    handlePaymentError,
    reset,
    setError,
  } = usePaymentFlow<ScoringResult>();

  const scoreResult = result?.scoreResult ?? null;
  const completed = state === "completed";

  const quoteDescription = useMemo(() => {
    if (!githubHandle.trim()) return "";
    const handle = githubHandle.trim().replace(/^@/, "");
    return `Score GitHub profile "@${handle}"`;
  }, [githubHandle]);

  const handleQuoteRequest = async () => {
    const handle = githubHandle.trim().replace(/^@/, "");
    
    if (!handle) {
      setError("Please enter a GitHub handle.");
      return;
    }

    if (!handle.match(/^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/)) {
      setError("Invalid GitHub handle format. Please enter a valid username.");
      return;
    }

    setError(null);

    const handleToScore = handle;

    await requestQuote({
      request: quoteDescription,
      execute: async (jobId: string, quote: any) => {
        console.log("Executing GitHub scoring for job:", jobId);
        
        if (!handleToScore) {
          throw new Error("GitHub handle is no longer available.");
        }

        try {
          const scoreResult = await scoreGitHub({
            githubHandle: handleToScore,
          });

          console.log("GitHub scoring completed successfully");
          return {
            scoreResult,
          };
        } catch (error) {
          console.error("Error during GitHub scoring execution:", error);
          throw error;
        }
      },
    });
  };

  const handleCopy = async () => {
    if (!scoreResult?.details) return;
    try {
      await navigator.clipboard.writeText(scoreResult.details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getRankPercentage = () => {
    if (!scoreResult) return 0;
    return Math.round(((scoreResult.totalUsers - scoreResult.rank + 1) / scoreResult.totalUsers) * 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-8">
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
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-gray-800/70 bg-gray-900/70 px-5 py-2 text-sm text-gray-300">
                <Trophy className="h-4 w-4 text-purple-300" />
                Comprehensive GitHub profile analysis & ranking
              </div>
              <h1 className="text-4xl font-bold sm:text-5xl">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  GitHub Scorer Agent
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-base text-gray-400">
                Connect your GitHub handle to receive a comprehensive score based on commits, activity,
                languages used, and contributions. Compare your rank against other developers in the network.
              </p>
            </div>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-3xl border border-gray-800/70 bg-gray-950/60 p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Enter your GitHub handle
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Provide your GitHub username to analyze your profile and calculate your developer score.
                </p>
              </div>
              <div className="hidden sm:block rounded-full bg-purple-500/10 p-3">
                <Github className="h-6 w-6 text-purple-300" />
              </div>
            </div>

            <div className="mt-6">
              <label className="group relative flex flex-col rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 transition focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/40">
                <span className="text-sm font-semibold text-gray-200">
                  GitHub Username
                </span>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-gray-500">@</span>
                  <input
                    type="text"
                    value={githubHandle.replace(/^@/, "")}
                    onChange={(e) => {
                      const value = e.target.value.replace(/^@/g, "");
                      setGithubHandle(value);
                      setError(null);
                      if (state !== "idle" && state !== "error") {
                        reset();
                      }
                    }}
                    placeholder="username"
                    className="flex-1 rounded-xl border border-dashed border-gray-800/60 bg-gray-950/40 px-4 py-3 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Enter your GitHub username (without @ symbol)
                </p>
              </label>
            </div>

            {error && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-gray-800/70 bg-gray-900/50 p-6 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span>Secure processing inside ICP canisters</span>
              </div>
              {state === "idle" || state === "error" || state === "completed" ? (
                <Button
                  onClick={handleQuoteRequest}
                  disabled={!githubHandle.trim() || loading || isProcessing}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 px-6 py-3 font-semibold shadow-[0_18px_45px_-18px_rgba(56,189,248,0.6)] transition hover:from-purple-500 hover:via-pink-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting Quote...
                    </span>
                  ) : (
                    "Get Score Quote"
                  )}
                </Button>
              ) : state === "quoted" && icpayConfig ? (
                <div className="flex-1">
                  <IcpayPayButton
                    config={icpayConfig}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
              ) : state === "waiting_for_payment" || state === "executing" ? (
                <Button
                  disabled
                  className="flex-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 px-6 py-3 font-semibold shadow-[0_18px_45px_-18px_rgba(56,189,248,0.6)] disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {state === "waiting_for_payment" ? "Waiting for Payment" : "Analyzing GitHub..."}
                  </span>
                </Button>
              ) : null}
            </div>

            {quote && state !== "completed" && (
              <div className="mt-6 rounded-2xl border border-purple-500/40 bg-purple-500/10 p-5 text-sm text-purple-100">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-purple-300/70">
                      Quoted Price
                    </p>
                    <p className="text-2xl font-semibold text-purple-100">
                      {quote.price} {quote.currency}
                    </p>
                  </div>
                  {paymentResult && (
                    <div className="text-xs text-purple-200/70">
                      Last transaction:{" "}
                      <span className="font-mono">{paymentResult.transactionId}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {state === "waiting_for_payment" && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Awaiting ICPay settlement...</span>
              </div>
            )}

            {state === "executing" && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 text-sm text-blue-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing GitHub profile in the canister...</span>
              </div>
            )}

            {paymentResult && completed && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-100">
                <CheckCircle2 className="h-4 w-4 text-green-300" />
                <span>
                  Payment confirmed. Transaction ID:{" "}
                  <span className="font-mono">{paymentResult.transactionId}</span>
                </span>
              </div>
            )}

            {scoreResult && completed && (
              <div className="mt-8 rounded-3xl border border-purple-500/30 bg-purple-500/5 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Score Results</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-800/70 bg-gray-900/60 px-3 py-2 text-xs text-gray-300 transition hover:border-purple-500/40 hover:text-purple-200"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-xs text-purple-200/70 underline underline-offset-4 hover:text-purple-100"
                    >
                      Score another profile
                    </button>
                  </div>
                </div>

                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6 text-center">
                    <div className="mb-2 flex items-center justify-center gap-2 text-sm text-purple-300">
                      <Trophy className="h-5 w-5" />
                      <span>Overall Score</span>
                    </div>
                    <p className={`text-5xl font-bold ${getScoreColor(scoreResult.score)}`}>
                      {scoreResult.score}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">out of 100</p>
                  </div>

                  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 text-center">
                    <div className="mb-2 flex items-center justify-center gap-2 text-sm text-blue-300">
                      <TrendingUp className="h-5 w-5" />
                      <span>Rank</span>
                    </div>
                    <p className="text-5xl font-bold text-blue-400">
                      #{scoreResult.rank}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Top {getRankPercentage()}% of {scoreResult.totalUsers.toLocaleString()} users
                    </p>
                  </div>
                </div>

                <div className="mb-6 rounded-2xl border border-gray-800/70 bg-gray-950/60 p-6">
                  <h4 className="mb-4 text-sm font-semibold text-gray-200">Score Breakdown</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Code2 className="h-5 w-5 text-purple-300" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Commits</span>
                          <span className="font-semibold text-purple-300">{scoreResult.breakdown.commits} pts</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Activity className="h-5 w-5 text-purple-300" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Activity</span>
                          <span className="font-semibold text-purple-300">{scoreResult.breakdown.activity} pts</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-5 w-5 text-purple-300" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Languages</span>
                          <span className="font-semibold text-purple-300">{scoreResult.breakdown.languages} pts</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Github className="h-5 w-5 text-purple-300" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Repositories</span>
                          <span className="font-semibold text-purple-300">{scoreResult.breakdown.repositories} pts</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <Users className="h-5 w-5 text-purple-300" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Contributions</span>
                          <span className="font-semibold text-purple-300">{scoreResult.breakdown.contributions} pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="prose prose-invert prose-sm max-w-none rounded-2xl border border-gray-800/70 bg-gray-950/60 p-6 text-gray-300">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-white mb-3 mt-5 first:mt-0">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-white mb-2 mt-4 first:mt-0">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-3 leading-relaxed">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-3 space-y-1 ml-4">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-3 space-y-1 ml-4">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="mb-1">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-white">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-purple-200">{children}</em>
                      ),
                      code: ({ children }) => (
                        <code className="bg-gray-900/50 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">
                          {children}
                        </code>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-purple-500/50 pl-4 my-4 italic text-gray-400">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {scoreResult.details}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-6 rounded-3xl border border-gray-800/70 bg-gray-950/70 p-8 backdrop-blur-xl">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Scoring methodology
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Commit frequency and consistency over time.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Activity patterns across repositories and projects.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Language diversity and technology stack breadth.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Repository quality, documentation, and maintenance.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Open source contributions and community engagement.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-6 text-sm text-purple-100">
              <h4 className="text-xs uppercase tracking-widest text-purple-300/80">
                Pro Tip
              </h4>
              <p className="mt-2 text-purple-200">
                Your score updates in real-time as your GitHub activity grows. Use the PaymentAgent
                workflow to schedule regular score checks and track your developer growth over time.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6 text-sm text-gray-300">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Trophy className="h-4 w-4 text-purple-300" />
                Ranking system
              </h4>
              <ul className="mt-3 space-y-2 text-xs text-gray-400">
                <li>• Compare your score against all users in the network</li>
                <li>• Real-time ranking updates as new profiles are scored</li>
                <li>• Historical tracking available via ICPay receipts</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6 text-sm text-gray-300">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Github className="h-4 w-4 text-purple-300" />
                Privacy & Security
              </h4>
              <p className="mt-2 text-xs text-gray-500">
                All GitHub data is processed securely inside ICP canisters. Your profile information
                is only used for scoring and ranking purposes.
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

