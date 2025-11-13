import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  LifeBuoy,
  Radar,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

type InsightPreset = "Trends" | "Anomalies" | "Forecast" | "Summary";

export default function CsvAnalyzerAgent() {
  const [selectedPreset, setSelectedPreset] = useState<InsightPreset>("Trends");
  const [includeVisuals, setIncludeVisuals] = useState(true);

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
            <div className="mx-auto flex flex-col gap-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-6 py-5 text-sm text-purple-200 shadow-[0_20px_60px_-30px_rgba(168,85,247,0.6)]">
              <span className="text-xs uppercase tracking-widest text-purple-300/80">
                Starting at
              </span>
              <span className="text-3xl font-semibold text-purple-100">
                0.07 ICP
              </span>
              <span className="text-xs text-purple-200/70">
                Scales with row count & advanced modeling options
              </span>
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

            <div className="mt-6 rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center transition hover:border-purple-500/50 hover:bg-gray-900/70">
              <Sparkles className="mx-auto h-10 w-10 text-purple-300" />
              <p className="mt-4 text-sm text-gray-300">
                Drop CSV here or <span className="text-purple-300">browse</span>
              </p>
              <p className="text-xs text-gray-500">
                Supports gzip-compressed files & streaming inputs
              </p>
            </div>

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
                      onClick={() => setSelectedPreset(preset)}
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
                    placeholder="Primary metric column"
                    className="rounded-xl border border-gray-800/80 bg-gray-900/60 px-3 py-2.5 text-xs text-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <input
                    type="text"
                    placeholder="Segment or group column"
                    className="rounded-xl border border-gray-800/80 bg-gray-900/60 px-3 py-2.5 text-xs text-gray-300 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-800/70 bg-gray-950/60 p-5 text-sm text-gray-300 transition hover:border-purple-500/40 hover:text-purple-200">
                <input
                  type="checkbox"
                  checked={includeVisuals}
                  onChange={() => setIncludeVisuals((value) => !value)}
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
                <Activity className="h-5 w-5 text-purple-300" />
                <span>
                  Processed with privacy-safe enclaves on the Internet Computer.
                </span>
              </div>
              <Button className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 px-6 py-3 font-semibold shadow-[0_18px_45px_-18px_rgba(56,189,248,0.6)] transition hover:from-purple-500 hover:via-pink-500 hover:to-blue-500">
                Continue to Payment
              </Button>
            </div>
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

