import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  CheckCircle,
  FileSpreadsheet,
  LifeBuoy,
  Loader2,
  Radar,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { analyzeCsv, MAX_CSV_SIZE } from "@/services/csvService";
import { usePaymentFlow } from "@/hooks/usePaymentFlow";
// @ts-ignore - ICPay widget types may not be fully resolved
import { IcpayPayButton } from "@ic-pay/icpay-widget/react";

type InsightPreset = "Trends" | "Anomalies" | "Forecast" | "Summary";

type AnalysisResult = {
  analysis: string;
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${sizes[i]}`;
};

export default function CsvAnalyzerAgent() {
  const [selectedPreset, setSelectedPreset] = useState<InsightPreset>("Trends");
  const [includeVisuals, setIncludeVisuals] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [primaryMetric, setPrimaryMetric] = useState("");
  const [segmentColumn, setSegmentColumn] = useState("");
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  } = usePaymentFlow<AnalysisResult>();

  const analysis = result?.analysis ?? null;
  const completed = state === "completed";

  const quoteDescription = useMemo(() => {
    if (!selectedFile) return "";
    return [
      `Analyze CSV "${selectedFile.name}"`,
      `Size: ${formatBytes(selectedFile.size)}`,
      `Preset: ${selectedPreset}`,
      primaryMetric && `Primary metric: ${primaryMetric}`,
      segmentColumn && `Segment: ${segmentColumn}`,
      `Include visuals: ${includeVisuals ? "Yes" : "No"}`,
    ]
      .filter(Boolean)
      .join(" | ");
  }, [selectedFile, selectedPreset, primaryMetric, segmentColumn, includeVisuals]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const [file] = Array.from(files).filter(
      (item) =>
        item.type === "text/csv" ||
        item.type === "application/vnd.ms-excel" ||
        item.name.endsWith(".csv")
    );
    if (!file) {
      setError("Please upload a CSV file.");
      return;
    }

    if (file.size > MAX_CSV_SIZE) {
      setError(
        `File size (${formatBytes(file.size)}) exceeds maximum allowed size of ${formatBytes(MAX_CSV_SIZE)}.`
      );
      setSelectedFile(null);
      return;
    }

    reset();
    setSelectedFile(file);
    setError(null);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleQuoteRequest = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file to analyze.");
      return;
    }

    setError(null);

    // Capture file reference to ensure it's available during execution
    const fileToAnalyze = selectedFile;
    const presetToUse = selectedPreset;
    const primaryMetricToUse = primaryMetric;
    const segmentColumnToUse = segmentColumn;
    const includeVisualsToUse = includeVisuals;

    console.log("Requesting quote with file:", {
      fileName: fileToAnalyze.name,
      fileSize: fileToAnalyze.size,
      preset: presetToUse,
    });

    await requestQuote({
      request: quoteDescription,
      execute: async (jobId: string, quote: any) => {
        console.log("Executing CSV analysis for job:", jobId);
        
        if (!fileToAnalyze) {
          throw new Error("File is no longer available.");
        }

        console.log("File still available:", {
          fileName: fileToAnalyze.name,
          fileSize: fileToAnalyze.size,
        });

        try {
          const analysisText = await analyzeCsv({
            file: fileToAnalyze,
            preset: presetToUse,
            primaryMetric: primaryMetricToUse.trim() || undefined,
            segmentColumn: segmentColumnToUse.trim() || undefined,
            includeVisuals: includeVisualsToUse,
          });

          console.log("CSV analysis completed successfully");
          return {
            analysis: analysisText,
          };
        } catch (error) {
          console.error("Error during CSV analysis execution:", error);
          throw error;
        }
      },
    });
  };

  const handleCopy = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
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
                <BarChart3 className="h-4 w-4 text-purple-300" />
                Auto-insight engine for your spreadsheets
              </div>
              <h1 className="text-4xl font-bold sm:text-5xl">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  CSV Analyzer Agent
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-base text-gray-400">
                Upload CSV datasets to detect trends, anomalies, and actionable insights.
                Configure the analysis objective and receive visual-ready summaries triggered
                through ICPay.
              </p>
            </div>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-3xl border border-gray-800/70 bg-gray-950/60 p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Import your dataset
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Drag a CSV or connect cloud storage. Maximum file size 150 MB.
                </p>
              </div>
              <div className="hidden sm:block rounded-full bg-purple-500/10 p-3">
                <FileSpreadsheet className="h-6 w-6 text-purple-300" />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                if (state !== "idle" && state !== "error") {
                  reset();
                }
              }}
            />

            <div
              onClick={handleBrowseClick}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`mt-6 rounded-2xl border border-dashed p-8 text-center transition ${
                isDragging
                  ? "border-purple-500/70 bg-purple-500/10"
                  : "border-gray-700 bg-gray-900/50 hover:border-purple-500/50 hover:bg-gray-900/70"
              }`}
            >
              <UploadCloud className="mx-auto h-10 w-10 text-purple-300" />
              <p className="mt-4 text-sm text-gray-300">
                Drop CSV here or{" "}
                <span className="text-purple-300 underline underline-offset-4">browse</span>
              </p>
              <p className="text-xs text-gray-500">
                Supports CSV files — max 150 MB per file
              </p>
              {selectedFile && (
                <div className="mt-6 rounded-xl border border-gray-800/60 bg-gray-900/70 p-4 text-left">
                  <p className="text-sm font-medium text-gray-200">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(selectedFile.size)} · Preset: {selectedPreset}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-8 grid gap-6 rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6">
              <h3 className="text-sm font-semibold text-gray-200">
                Select analysis objective
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["Trends", "Anomalies", "Forecast", "Summary"] as InsightPreset[]).map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(preset);
                        if (state !== "idle" && state !== "error") {
                          reset();
                        }
                      }}
                      className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
                        selectedPreset === preset
                          ? "border-purple-500 bg-purple-500/20 text-purple-100 shadow-[0_18px_45px_-25px_rgba(168,85,247,0.8)]"
                          : "border-gray-800/80 bg-gray-950/60 text-gray-400 hover:border-purple-500/40 hover:text-purple-200"
                      }`}
                    >
                      <span className="font-semibold">{preset}</span>
                      <p className="mt-1 text-xs text-gray-500">
                        {preset === "Trends" && "Identify key movements and correlated variables."}
                        {preset === "Anomalies" && "Surface outliers and unusual behavior."}
                        {preset === "Forecast" && "Project future values via ML baselines."}
                        {preset === "Summary" &&
                          "Generate a digestible overview ready for stakeholders."}
                      </p>
                    </button>
                  )
                )}
              </div>

              <div className="grid gap-4 rounded-2xl border border-gray-800/70 bg-gray-950/60 p-6 text-sm text-gray-300 sm:grid-cols-[auto,1fr] sm:items-center">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="h-4 w-4 text-purple-300" />
                  <span className="font-semibold text-gray-200">
                    Configure optional fields
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={primaryMetric}
                    onChange={(e) => {
                      setPrimaryMetric(e.target.value);
                      if (state !== "idle" && state !== "error") {
                        reset();
                      }
                    }}
                    placeholder="Primary metric column"
                    className="rounded-xl border border-gray-800/80 bg-gray-900/60 px-3 py-2.5 text-xs text-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <input
                    type="text"
                    value={segmentColumn}
                    onChange={(e) => {
                      setSegmentColumn(e.target.value);
                      if (state !== "idle" && state !== "error") {
                        reset();
                      }
                    }}
                    placeholder="Segment or group column"
                    className="rounded-xl border border-gray-800/80 bg-gray-900/60 px-3 py-2.5 text-xs text-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-800/70 bg-gray-950/60 p-5 text-sm text-gray-300 transition hover:border-purple-500/40 hover:text-purple-200">
                <input
                  type="checkbox"
                  checked={includeVisuals}
                  onChange={() => {
                    setIncludeVisuals((value) => !value);
                    if (state !== "idle" && state !== "error") {
                      reset();
                    }
                  }}
                  className="h-4 w-4 rounded border border-gray-700 bg-gray-900 text-purple-500 focus:ring-purple-500"
                />
                <div>
                  <span className="font-semibold text-gray-200">
                    Auto-generate visualizations & dashboards
                  </span>
                  <p className="text-xs text-gray-500">
                    Receive PNG snapshots plus Vega specs ready for embedding.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-gray-800/70 bg-gray-900/50 p-6 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span>Secure processing inside ICP canisters</span>
              </div>
              {state === "idle" || state === "error" || state === "completed" ? (
                <Button
                  onClick={handleQuoteRequest}
                  disabled={!selectedFile || loading || isProcessing || (selectedFile?.size ?? 0) > MAX_CSV_SIZE}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 px-6 py-3 font-semibold shadow-[0_18px_45px_-18px_rgba(56,189,248,0.6)] transition hover:from-purple-500 hover:via-pink-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting Quote...
                    </span>
                  ) : (
                    "Get Analysis Quote"
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
                    {state === "waiting_for_payment" ? "Waiting for Payment" : "Analyzing..."}
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
                <span>Analyzing CSV in the canister...</span>
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

            {analysis && completed && (
              <div className="mt-8 rounded-3xl border border-purple-500/30 bg-purple-500/5 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Analysis Results</h3>
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
                      Start new analysis
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
                    {analysis}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-6 rounded-3xl border border-gray-800/70 bg-gray-950/70 p-8 backdrop-blur-xl">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Output package
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Narrative executive summary with key metrics & insights.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Downloadable CSV of tagged anomalies and growth drivers.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Optional chart gallery ready for decks and dashboards.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-6 text-sm text-purple-100">
              <h4 className="text-xs uppercase tracking-widest text-purple-300/80">
                Pro Tip
              </h4>
              <p className="mt-2 text-purple-200">
                Pair this agent with PaymentAgent webhooks to auto-trigger fresh reports
                when new datasets land in your storage bucket.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6 text-sm text-gray-300">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Radar className="h-4 w-4 text-purple-300" />
                Observability
              </h4>
              <ul className="mt-3 space-y-2 text-xs text-gray-400">
                <li>• Processing time estimates prior to payment</li>
                <li>• Run history & audit trail stored with ICPay receipts</li>
                <li>• Export machine-readable JSON for automation loops</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6 text-sm text-gray-300">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
                <LifeBuoy className="h-4 w-4 text-purple-300" />
                Need help?
              </h4>
              <p className="mt-2 text-xs text-gray-500">
                Custom modeling available for regulated industries. Contact the Autonomous
                Agents Network for a co-pilot session.
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}