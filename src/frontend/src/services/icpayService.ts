import { Quote } from "@/types/quote";
// @ts-ignore - ICPay widget types may not be fully resolved
import { IcpaySuccess } from "@ic-pay/icpay-widget/react";
import { PaymentResult } from "@/types/payment";

/**
 * ICPay service for handling payment-related operations
*/
export interface ICPayConfig {
  publishableKey: string;
  amountUsd: number;
  defaultSymbol: string;
  showLedgerDropdown: 'none' | 'buttons' | 'dropdown';
  progressBar: {
    enabled: boolean;
    mode: 'modal' | 'horizontal' | 'vertical' | 'inline';
  };
  metadata?: Record<string, number | string>;
}

/**
 * Validates and retrieves the ICPay publishable key from environment variables
 * @returns The publishable key if valid, null otherwise
 */
export const getPublishableKey = (): string | null => {
  const publishableKey = import.meta.env.VITE_PUBLIC_KEY || '';

  if (!publishableKey || publishableKey.trim() === '') {
    console.error('ICPay publishable key is missing. Please set PUBLIC_KEY in your environment variables.');
    return null;
  }
  
  // Check if user accidentally used a secret key instead of publishable key
  if (publishableKey.startsWith('sk_')) {
    console.error('ERROR: You are using a SECRET KEY (sk_) instead of a PUBLISHABLE KEY (pk_). Secret keys should NEVER be used in frontend code.');
    return null;
  }
  
  console.log("Getting publishable key... done");
  return publishableKey;
};

/**
 * Creates ICPay configuration from a quote
 * @param quote - The quote object containing price and job information
 * @param userRequest - The user's original request (for metadata)
 * @returns ICPay configuration object or null if publishable key is invalid
 */
export const createICPayConfig = (
  quote: Quote | null,
  userRequest: string
): ICPayConfig | null => {
  console.log("Creating ICPay config...");
  if (!quote) return null;
  
  const publishableKey = getPublishableKey();
  if (!publishableKey) return null;

  console.log("Creating ICPay config... done");
  return {
    publishableKey,
    amountUsd: quote.price,
    defaultSymbol: quote.currency === "ICP" ? "ICP" : "ICP",
    showLedgerDropdown: 'dropdown',
    progressBar: { enabled: true, mode: 'modal' },
    metadata: {
      job_id: Number(quote.job_id),
      request: userRequest,
    },
  };
};

/**
 * Converts ICPay success response to PaymentResult
 * @param detail - The ICPay success detail object
 * @returns PaymentResult object
 */
export const handlePaymentSuccess = (detail: IcpaySuccess | any): PaymentResult => {
  console.log("Handling payment success...");
  console.log("detail", detail);
  console.log("detail.tx", detail.tx);
  
  const transactionId = detail?.tx?.transactionId || detail?.id || '';
  
  console.log("Extracted transaction ID:", transactionId);
  
  return {
    transactionId: String(transactionId),
    success: true,
  };
};

/**
 * Handles payment errors and converts them to user-friendly error messages
 * @param error - The error object from ICPay
 * @returns A user-friendly error message string
 */
export const handlePaymentError = (error: unknown): string => {
  console.error("Payment error:", error);
  
  let errorMessage = 'Payment failed. Please try again.';
  
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: string }).message;
    
    // Provide user-friendly error messages
    if (msg.includes('Failed to fetch verified ledgers') || msg.includes('401')) {
      errorMessage = 'ICPay authentication failed. Please check your publishable key (PUBLIC_KEY) in your environment variables.';
    } else if (msg.includes('CORS') || msg.includes('Failed to fetch')) {
      errorMessage = 'Network error. Please ensure your Internet Computer replica is running and accessible. If using a wallet, check that the IC replica endpoint is configured correctly.';
    } else {
      errorMessage = msg;
    }
  }
  
  return errorMessage;
};

/**
 * Checks if ICPay is properly configured
 * @returns true if publishable key is valid, false otherwise
 */
export const isICPayConfigured = (): boolean => {
  return getPublishableKey() !== null;
};