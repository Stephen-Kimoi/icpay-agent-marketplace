import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Highlighter,
  Loader2,
  ScrollText,
  Sparkles,
  Wand2,
  AlertCircle,
  Copy,
  CheckCircle,
} from "lucide-react";
import { summarizeText, MAX_TEXT_LENGTH } from "@/services/textSummarizerService";
import { usePaymentFlow } from "@/hooks/usePaymentFlow";
// @ts-ignore - ICPay widget types may not be fully resolved
import { IcpayPayButton } from "@ic-pay/icpay-widget/react";

const tonePresets = [
  "Executive Summary",
  "Creative Highlights",
  "Technical Abstract",
  "Bullet Digest",
] as const;

type TonePreset = (typeof tonePresets)[number];

type SummarizationResult = {
  summary: string;
};

export default function TextSummarizerAgent() {
  const [selectedTone, setSelectedTone] = useState<TonePreset>("Executive Summary");
  const [includeQuotes, setIncludeQuotes] = useState(true);
  const [text, setText] = useState("");
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
  } = usePaymentFlow<SummarizationResult>();

  const summary = result?.summary ?? null;
  const completed = state === "completed";

  const quoteDescription = useMemo(() => {
    if (!text.trim()) return "";
    return [
      `Summarize text (${text.length} characters)`,
      `Tone: ${selectedTone}`,
      `Include quotes: ${includeQuotes ? "Yes" : "No"}`,
    ].join(" | ");
  }, [text, selectedTone, includeQuotes]);

  const handleQuoteRequest = async () => {
    if (!text.trim()) {
      setError("Please enter some text to summarize.");
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      setError(
        `Text length (${text.length} characters) exceeds maximum allowed length of ${MAX_TEXT_LENGTH} characters.`
      );
      return;
    }

    setError(null);

    await requestQuote({
      request: quoteDescription,
      execute: async () => {
        const summaryText = await summarizeText({
          text: text.trim(),
          tone: selectedTone,
          includeQuotes,
        });
        return {
          summary: summaryText,
        };
      },
    });
  };

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const characterCount = text.length;
  const characterLimit = MAX_TEXT_LENGTH;

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
                <Sparkles className="h-4 w-4 text-purple-300" />
                LLM-powered synthesis with audience awareness
              </div>
              <h1 className="text-4xl font-bold sm:text-5xl">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Text Summarizer Agent
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-base text-gray-400">
                Upload documents, paste long-form content, or reference URLs and receive
                concise, tone-aware summaries optimized for your stakeholders. Perfect for
                briefings, recaps, and knowledge sharing.
              </p>
            </div>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-3xl border border-gray-800/70 bg-gray-950/60 p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Provide the content to summarize
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Combine text input with optional file attachments for richer context.
                </p>
              </div>
              <div className="hidden sm:block rounded-full bg-purple-500/10 p-3">
                <ScrollText className="h-6 w-6 text-purple-300" />
              </div>
            </div>

            <div className="mt-6 grid gap-6">
              <label className="group relative flex min-h-[220px] flex-col rounded-2xl border border-gray-800/80 bg-gray-900/60 p-5 transition focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/40">
                <span className="text-sm font-semibold text-gray-200">
                  Paste long-form text
                </span>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                    if (state !== "idle" && state !== "error") {
                      reset();
                    }
                  }}
                  placeholder="Drop your article, meeting transcript, or blog post here…"
                  className="mt-3 flex-1 resize-none rounded-2xl border border-dashed border-gray-800/60 bg-gray-950/40 p-4 text-sm text-gray-300 placeholder-gray-500 focus:outline-none"
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Up to {characterLimit.toLocaleString()} characters per request
                  </span>
                  <span
                    className={`text-xs ${
                      characterCount > characterLimit
                        ? "text-red-400"
                        : characterCount > characterLimit * 0.9
                        ? "text-yellow-400"
                        : "text-gray-400"
                    }`}
                  >
                    {characterCount.toLocaleString()} / {characterLimit.toLocaleString()}
                  </span>
                </div>
              </label>

              <div className="grid gap-4 rounded-2xl border border-dashed border-gray-800/70 bg-gray-900/60 p-6 text-sm text-gray-300 transition hover:border-purple-500/50 hover:bg-gray-900/80 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <h3 className="font-semibold text-gray-200">Attach references</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Drop files (.pdf, .docx, .txt) or paste up to 3 URLs for context.
                  </p>
                </div>
                <Button
                  type="button"
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 px-5 py-2.5 text-sm font-semibold transition hover:from-purple-500 hover:via-pink-500 hover:to-blue-500"
                >
                  Add Attachments
                </Button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6">
              <h3 className="text-sm font-semibold text-gray-200">
                Tailor the summary
              </h3>
              <div className="flex flex-wrap gap-3">
                {tonePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSelectedTone(preset);
                      if (state !== "idle" && state !== "error") {
                        reset();
                      }
                    }}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      selectedTone === preset
                        ? "border-purple-500 bg-purple-500/20 text-purple-100 shadow-[0_18px_45px_-25px_rgba(168,85,247,0.8)]"
                        : "border-gray-800/80 bg-gray-950/60 text-gray-400 hover:border-purple-500/40 hover:text-purple-200"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-gray-800/70 bg-gray-950/60 p-5 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={includeQuotes}
                    onChange={() => {
                      setIncludeQuotes((value) => !value);
                      if (state !== "idle" && state !== "error") {
                        reset();
                      }
                    }}
                    className="h-4 w-4 rounded border border-gray-700 bg-gray-900 text-purple-500 focus:ring-purple-500"
                  />
                  <span>Highlight standout quotes & statistics</span>
                </label>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-800/70 bg-gray-900/60 px-4 py-2 text-xs uppercase tracking-wide text-gray-400 transition hover:border-purple-500/40 hover:text-purple-200"
                >
                  <Highlighter className="h-4 w-4" />
                  Add Tone Instructions
                </button>
              </div>
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
                  disabled={!text.trim() || loading || isProcessing || text.length > MAX_TEXT_LENGTH}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 px-6 py-3 font-semibold shadow-[0_18px_45px_-18px_rgba(56,189,248,0.6)] transition hover:from-purple-500 hover:via-pink-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting Quote...
                    </span>
                  ) : (
                    "Get Summary Quote"
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
                    {state === "waiting_for_payment" ? "Waiting for Payment" : "Summarizing..."}
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
                <span>Generating summary in the canister...</span>
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

            {summary && completed && (
              <div className="mt-8 rounded-3xl border border-purple-500/30 bg-purple-500/5 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Summary</h3>
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
                      Start new summary
                    </button>
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
                    {summary}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-6 rounded-3xl border border-gray-800/70 bg-gray-950/70 p-8 backdrop-blur-xl">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Ideal for
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Product updates, investor notes, and customer success recaps.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Executive briefings synthesized from research docs.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  AI-ready knowledge hubs, newsletters, and updates.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-6 text-sm text-purple-100">
              <h4 className="text-xs uppercase tracking-widest text-purple-300/80">
                Insight
              </h4>
              <p className="mt-2 text-purple-200">
                Use the PaymentAgent workflow to trigger automated distribution—email
                summaries to leadership or publish directly into Notion.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6 text-sm text-gray-300">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                <BookOpenCheck className="h-4 w-4 text-purple-300" />
                Output formats
              </h4>
              <ul className="mt-3 space-y-2 text-xs text-gray-400">
                <li>• Executive bullet sheet (Markdown)</li>
                <li>• Narrative prose with key highlights</li>
                <li>• Optional short-form social copy</li>
              </ul>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

