import { useCallback, useMemo, useRef, useState } from "react";
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

interface UsePaymentFlowOptions {
  mockPrice?: number;
  mockPayment?: boolean;
  mockCurrency?: string;
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
  simulatePayment?: () => Promise<void>;
}

export function usePaymentFlow<T>(
  options?: UsePaymentFlowOptions
): UsePaymentFlowReturn<T> {
  const { mockPrice, mockPayment = false, mockCurrency = "ICP" } = options || {};
  const [state, setState] = useState<PaymentState>("idle");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestDescription, setRequestDescription] = useState("");

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
        
        // Override quote price if mock mode is enabled
        const finalQuote = mockPayment && mockPrice !== undefined
          ? { ...quoteResponse, price: mockPrice, currency: mockCurrency || "ICP" }
          : quoteResponse;
        
        setQuote(finalQuote);

        try {
          await initiatePayment(finalQuote.job_id);
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
    [mockPayment, mockPrice, mockCurrency]
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

  const simulatePayment = useCallback(async () => {
    if (!mockPayment) {
      return;
    }

    if (!quote) {
      setError("Quote not found. Cannot simulate payment.");
      setState("error");
      return;
    }

    const execute = executeRef.current;
    if (!execute) {
      setError("Execution handler not configured.");
      setState("error");
      return;
    }

    try {
      // Simulate payment success
      const mockPaymentResult: PaymentResult = {
        transactionId: `mock-tx-${Date.now()}`,
        success: true,
      };

      setPaymentResult(mockPaymentResult);
      setState("waiting_for_payment");
      setError(null);

      await completePayment(String(quote.job_id), mockPaymentResult.transactionId);

      setState("executing");

      const executionResult = await execute(quote.job_id, quote);
      setResult(executionResult);

      setState("completed");
    } catch (err) {
      console.error("Error simulating payment or executing job:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to simulate payment or execute job. Please try again."
      );
      setState("error");
    }
  }, [mockPayment, quote, mockPrice, mockCurrency]);

  const reset = useCallback(() => {
    setState("idle");
    setQuote(null);
    setPaymentResult(null);
    setResult(null);
    setError(null);
    setRequestDescription("");
    executeRef.current = null;
  }, []);

  const icpayConfig = useMemo(
    () => createICPayConfig(quote, requestDescription),
    [quote, requestDescription]
  );

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
    simulatePayment: mockPayment ? simulatePayment : undefined,
  };
}

