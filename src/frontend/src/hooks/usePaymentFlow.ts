import { useCallback, useEffect, useRef, useState } from "react";
import type { Quote } from "@/types/quote";
import type { PaymentResult, PaymentState } from "@/types/payment";
import { getQuote } from "@/services/quoteService";
import { initiatePayment, completePayment } from "@/services/jobService";
import {
  createICPayConfig,
  handlePaymentError as icpayHandlePaymentError,
  handlePaymentSuccess as icpayHandlePaymentSuccess,
} from "@/services/icpayService";
// @ts-ignore - ICPay widget types may not be fully resolved
import type { ICPayConfig } from "@ic-pay/icpay-widget/react";

type ExecuteFn<T> = (jobId: string, quote: Quote) => Promise<T>;

interface QuoteRequest<T> {
  request: string;
  execute: ExecuteFn<T>;
}

interface UsePaymentFlowReturn<T> {
  state: PaymentState;
  quote: Quote | null;
  paymentResult: PaymentResult | null;
  result: T | null;
  error: string | null;
  loading: boolean;
  isProcessing: boolean;
  icpayConfig: ICPayConfig | null;
  requestQuote: (payload: QuoteRequest<T>) => Promise<void>;
  handlePaymentSuccess: (detail: unknown) => Promise<void>;
  handlePaymentError: (error: unknown) => void;
  reset: () => void;
  setError: (message: string | null) => void;
}

export function usePaymentFlow<T>(): UsePaymentFlowReturn<T> {
  const [state, setState] = useState<PaymentState>("idle");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestDescription, setRequestDescription] = useState("");
  const [icpayConfig, setIcpayConfig] = useState<ICPayConfig | null>(null);

  const executeRef = useRef<ExecuteFn<T> | null>(null);

  const requestQuote = useCallback(
    async ({ request, execute }: QuoteRequest<T>) => {
      setLoading(true);
      setError(null);
      setPaymentResult(null);
      setResult(null);
      setState("idle");
      setRequestDescription(request);
      executeRef.current = execute;

      try {
        const quoteResponse = await getQuote(request);
        setQuote(quoteResponse);

        try {
          await initiatePayment(quoteResponse.job_id);
        } catch (paymentInitError) {
          console.warn("Payment initiation warning:", paymentInitError);
        }

        setState("quoted");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get quote. Please try again.");
        setState("error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handlePaymentSuccess = useCallback(
    async (detail: unknown) => {
      if (!quote) {
        setError("Quote not found. Cannot complete payment.");
        setState("error");
        return;
      }

      const execute = executeRef.current;
      if (!execute) {
        setError("Compression handler not configured.");
        setState("error");
        return;
      }

      try {
        const resultData = icpayHandlePaymentSuccess(detail);
        setPaymentResult(resultData);
        setState("waiting_for_payment");
        setError(null);

        await completePayment(String(quote.job_id), resultData.transactionId);

        setState("executing");

        const executionResult = await execute(quote.job_id, quote);
        setResult(executionResult);

        setState("completed");
      } catch (err) {
        console.error("Error completing payment or executing job:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to complete payment or execute job. Please try again."
        );
        setState("error");
      }
    },
    [quote]
  );

  const handlePaymentError = useCallback((paymentError: unknown) => {
    const message = icpayHandlePaymentError(paymentError);
    setError(message);
    setState("error");
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setQuote(null);
    setPaymentResult(null);
    setResult(null);
    setError(null);
    setRequestDescription("");
    setIcpayConfig(null);
    executeRef.current = null;
  }, []);

  // Fetch ICPay config when quote or request description changes
  useEffect(() => {
    const fetchConfig = async () => {
      if (quote && requestDescription) {
        try {
          const config = await createICPayConfig(quote, requestDescription);
          setIcpayConfig(config);
        } catch (err) {
          console.error("Failed to create ICPay config:", err);
          setIcpayConfig(null);
        }
      } else {
        setIcpayConfig(null);
      }
    };

    fetchConfig();
  }, [quote, requestDescription]);

  const isProcessing = state === "executing" || loading;

  return {
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
  };
}

