import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Gauge,
  UploadCloud,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function PdfCompressorAgent() {
  const [compressionLevel, setCompressionLevel] = useState(70);

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
                <Zap className="h-4 w-4 text-purple-300" />
                Optimized for large documents & batch workflows
              </div>
              <h1 className="text-4xl font-bold sm:text-5xl">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  PDF Compressor Agent
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-base text-gray-400">
                Turn oversized PDFs into lightning-fast documents without losing
                fidelity. Choose the compression profile, upload your files, and
                receive a download link once ICPay confirms payment.
              </p>
            </div>
            <div className="mx-auto flex flex-col gap-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-6 py-5 text-sm text-purple-200 shadow-[0_20px_60px_-30px_rgba(168,85,247,0.6)]">
              <span className="text-xs uppercase tracking-widest text-purple-300/80">
                Starting at
              </span>
              <span className="text-3xl font-semibold text-purple-100">
                0.05 ICP
              </span>
              <span className="text-xs text-purple-200/70">
                Pricing adapts by file size & compression intensity
              </span>
            </div>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-3xl border border-gray-800/70 bg-gray-950/60 p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Upload your PDF batch
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Drag & drop up to 10 files or browse manually. Max 250 MB per
                  file.
                </p>
              </div>
              <div className="hidden sm:block rounded-full bg-purple-500/10 p-3">
                <FileText className="h-6 w-6 text-purple-300" />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-8 text-center transition hover:border-purple-500/50 hover:bg-gray-900/70">
              <UploadCloud className="mx-auto h-10 w-10 text-purple-300" />
              <p className="mt-4 text-sm text-gray-300">
                Drop files here or <span className="text-purple-300">browse</span>
              </p>
              <p className="text-xs text-gray-500">
                Supported formats: PDF, PDF/A
              </p>
            </div>

            <div className="mt-8 grid gap-6 rounded-2xl border border-gray-800/70 bg-gray-900/60 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">
                    Compression Profile
                  </h3>
                  <p className="text-xs text-gray-500">
                    Balance quality vs. size reduction
                  </p>
                </div>
                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
                  {compressionLevel}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Gauge className="h-5 w-5 text-purple-300" />
                <input
                  type="range"
                  min={30}
                  max={90}
                  value={compressionLevel}
                  onChange={(event) =>
                    setCompressionLevel(Number(event.target.value))
                  }
                  className="flex-1 accent-purple-500"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Minimal", value: 45 },
                  { label: "Balanced", value: 70 },
                  { label: "Aggressive", value: 85 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setCompressionLevel(preset.value)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      compressionLevel === preset.value
                        ? "border-purple-500 bg-purple-500/20 text-purple-100 shadow-[0_15px_40px_-30px_rgba(168,85,247,0.8)]"
                        : "border-gray-800/80 bg-gray-900/60 text-gray-400 hover:border-purple-500/40 hover:text-purple-200"
                    }`}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-gray-800/70 bg-gray-900/50 p-6 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span>Secure processing inside ICP canisters</span>
              </div>
              <Button className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 px-6 py-3 font-semibold shadow-[0_18px_45px_-18px_rgba(56,189,248,0.6)] transition hover:from-purple-500 hover:via-pink-500 hover:to-blue-500">
                Continue to Payment
              </Button>
            </div>
          </section>

          <aside className="flex flex-col gap-6 rounded-3xl border border-gray-800/70 bg-gray-950/70 p-8 backdrop-blur-xl">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Why teams love this agent
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Up to 90% smaller files with visual quality preserved.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Automatic OCR cleanup for scans and forms.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-purple-300" />
                  Batch automation ready via ICPay webhooks.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-6 text-sm text-purple-100">
              <h4 className="text-xs uppercase tracking-widest text-purple-300/80">
                Tip
              </h4>
              <p className="mt-2 text-purple-200">
                For critical documents, start with the Balanced preset, then use
                the audit trail in PaymentAgent to validate output before
                scaling your workflow.
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

