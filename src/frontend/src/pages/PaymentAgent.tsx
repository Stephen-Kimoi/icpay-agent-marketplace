import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Clock, Sparkles } from "lucide-react";
// @ts-ignore - ICPay widget types may not be fully resolved
import { IcpayPayButton } from "@ic-pay/icpay-widget/react";
import { JobResult } from "@/types/payment";
import { executeJob } from "@/services/jobService";
import { usePaymentFlow } from "@/hooks/usePaymentFlow";

export default function PaymentAgent() {
  const [userRequest, setUserRequest] = useState("");
  const {
    state,
    quote,
    paymentResult,
    result: jobResult,
    error,
    loading,
    isProcessing,
    icpayConfig,
    requestQuote,
    handlePaymentSuccess,
    handlePaymentError,
    reset,
    setError,
  } = usePaymentFlow<JobResult>();

  const handleGetQuote = async (): Promise<void> => {
    if (!userRequest.trim()) {
      setError("Please enter a request");
      return;
    }

    await requestQuote({
      request: userRequest,
      execute: (jobId) => executeJob(jobId),
    });
  };

  const handleReset = (): void => {
    setUserRequest("");
    reset();
  };

  const getStepStatus = (step: number): string => {
    if (state === "idle" || state === "error") {
      return step === 1 ? "active" : "pending";
    }
    if (state === "quoted") {
      return step === 1 ? "completed" : step === 2 ? "active" : "pending";
    }
    if (state === "waiting_for_payment") {
      return step <= 2 ? "completed" : step === 3 ? "active" : "pending";
    }
    if (state === "executing") {
      return step <= 3 ? "completed" : step === 4 ? "active" : "pending";
    }
    return "completed";
  };

  const isPaymentPending = false;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Autonomous Payment Agent
          </h1>
        </div>
        <p className="text-gray-400 text-lg">
          Powered by <a href="https://icpay.org" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">icpay</a>
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 p-8">
        {/* Progress Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[
              { label: "Quote", icon: Clock },
              { label: "Payment", icon: Loader2 },
              { label: "Settling", icon: Loader2 },
              { label: "Executing", icon: Sparkles },
              { label: "Done", icon: CheckCircle2 },
            ].map((step, index) => {
              const stepNum = index + 1;
              const status = getStepStatus(stepNum);
              const Icon = step.icon;
              const isLast = index === 4;

              return (
                <div key={stepNum} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        status === "completed"
                          ? "bg-green-500 text-white"
                          : status === "active"
                            ? "bg-purple-500 text-white animate-pulse"
                            : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        status === "completed"
                          ? "text-green-400"
                          : status === "active"
                            ? "text-purple-400"
                            : "text-gray-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`h-1 flex-1 mx-2 transition-all duration-300 ${
                        status === "completed"
                          ? "bg-green-500"
                          : status === "active"
                            ? "bg-purple-500/50"
                            : "bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Input Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter your request
          </label>
          <textarea
            value={userRequest}
            onChange={(e) => { setUserRequest(e.target.value); }}
            placeholder="e.g., Solve the math problem: 15 * 23, or Write a short poem about automation"
            className="w-full min-h-[120px] px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
            disabled={isProcessing || (state !== "idle" && state !== "error" && state !== "quoted")}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading Quote */}
        {loading && (
          <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            <span className="text-purple-300">Getting quote...</span>
          </div>
        )}

        {/* Quote Display */}
        {quote && state !== "completed" && (
          <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Quoted Price</p>
                <p className="text-2xl font-bold text-purple-400">
                  {quote.price} {quote.currency}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={handleGetQuote}
            disabled={isProcessing || (state !== "idle" && state !== "error" && state !== "quoted")}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Getting Quote...
              </span>
            ) : (
              state === "idle" || state === "error" ? "Get Quote" : "New Quote"
            )}
          </Button>

          {state === "quoted" && (
            <div className="flex-1">
              {icpayConfig ? (
                <IcpayPayButton
                  config={icpayConfig}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              ) : (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm">
                  <p className="font-semibold mb-1">Configuration Error</p>
                  <p>ICPay publishable key is missing. Please set PUBLIC_KEY in your environment variables.</p>
                  <p className="mt-2 text-xs text-yellow-400">See README.md for setup instructions.</p>
                </div>
              )}
            </div>
          )}

          {state === "completed" && (
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700/50 font-semibold py-6 rounded-lg transition-all"
            >
              Start New Request
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {state === "waiting_for_payment" && isPaymentPending && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
            <span className="text-yellow-300">Processing payment and waiting for settlement...</span>
          </div>
        )}

        {state === "executing" && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
            <span className="text-blue-300">Executing job with LLM canister...</span>
          </div>
        )}

        {/* Payment Success Message */}
        {paymentResult && state === "completed" && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-green-300 font-semibold">Payment Successful</span>
            </div>
            <p className="text-sm text-gray-400">
              Transaction ID: <span className="font-mono text-gray-300">{paymentResult.transactionId}</span>
            </p>
          </div>
        )}

        {/* Job Result */}
        {jobResult && (
          <div className="mt-6 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Result
            </h3>
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                {jobResult.output}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Configure payment functionality to enable payments.</p>
      </div>
    </div>
  );
}

