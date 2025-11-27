import { Quote } from "@/types/quote";
// @ts-ignore - ICPay widget types may not be fully resolved
import { IcpaySuccess } from "@ic-pay/icpay-widget/react";
import { PaymentResult } from "@/types/payment";
import { ENV } from "@/config";

/**
 * ICPay service for handling payment-related operations
 * Updated to match the new ICPay widget configuration format
 */
export interface ICPayConfig {
  publishableKey: string;
  amountUsd?: number;
  priceUsd?: number;
  // Token filtering options to resolve Plug wallet issues
  chainTypes?: Array<'ic' | 'evm'>;
  chainShortcodes?: string[];
  tokenShortcodes?: string[];
  // Progress bar configuration
  progressBar?: {
    enabled?: boolean;
  };
  // Theme and UI options
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    textColor?: string;
    mutedTextColor?: string;
    surfaceColor?: string;
    surfaceAltColor?: string;
    borderColor?: string;
    fontFamily?: string;
  };
  // Wallet and connection options
  plugNPlay?: {
    enabled?: boolean;
    theme?: {
      modalBackground?: string;
      modalBorderRadius?: string;
      buttonBackground?: string;
      buttonHoverBackground?: string;
      textColor?: string;
      primaryColor?: string;
    };
    adapters?: Record<string, {
      enabled?: boolean;
      config?: Record<string, any>;
    }>;
  };
  // Advanced options
  useOwnWallet?: boolean;
  connectedWallet?: { owner: string };
  actorProvider?: any;
  derivationOrigin?: string;
  openOisyInNewTab?: boolean;
  disablePaymentButton?: boolean;
  disableAfterSuccess?: boolean;
  metadata?: Record<string, number | string>;
  debug?: boolean;
  timeout?: number;
  // SDK passthrough options
  apiUrl?: string;
  icHost?: string;
  evmProvider?: any;
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

// Cache for ICP price to avoid excessive API calls
let icpPriceCache: { price: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 1 minute cache

/**
 * Fetches the current ICP/USD exchange rate from CoinGecko API
 * @returns The current ICP price in USD
 * @throws Error if the API call fails
 */
const fetchICPPrice = async (): Promise<number> => {
  // Check cache first
  if (icpPriceCache && Date.now() - icpPriceCache.timestamp < CACHE_DURATION) {
    console.log(`Using cached ICP price: $${icpPriceCache.price}`);
    return icpPriceCache.price;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd'
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const price = data['internet-computer']?.usd;

    if (!price || typeof price !== 'number') {
      throw new Error('Invalid price data from CoinGecko API');
    }

    // Update cache
    icpPriceCache = {
      price,
      timestamp: Date.now(),
    };

    console.log(`Fetched ICP price from CoinGecko: $${price}`);
    return price;
  } catch (error) {
    console.error('Failed to fetch ICP price from CoinGecko:', error);
    
    // Fallback to cached price if available, even if expired
    if (icpPriceCache) {
      console.warn(`Using expired cached ICP price: $${icpPriceCache.price}`);
      return icpPriceCache.price;
    }

    // Final fallback to environment variable or default
    const fallbackRate = parseFloat(import.meta.env.VITE_ICP_USD_RATE || '6.5');
    console.warn(`Using fallback ICP price: $${fallbackRate}`);
    return fallbackRate;
  }
};

/**
 * Converts ICP amount to USD using live exchange rate
 * @param icpAmount - Amount in ICP
 * @returns Amount in USD
 */
const convertICPtoUSD = async (icpAmount: number): Promise<number> => {
  const icpToUsdRate = await fetchICPPrice();
  return icpAmount * icpToUsdRate;
};

/**
 * Creates ICPay configuration from a quote
 * @param quote - The quote object containing price and job information
 * @param userRequest - The user's original request (for metadata)
 * @returns ICPay configuration object or null if publishable key is invalid
 */
export const createICPayConfig = async (
  quote: Quote | null,
  userRequest: string
): Promise<ICPayConfig | null> => {
  console.log("Creating ICPay config...");
  if (!quote) return null;
  
  const publishableKey = getPublishableKey();
  if (!publishableKey) return null;

  // Convert quote price to USD if it's in ICP
  const priceUsd = quote.currency === "ICP" 
    ? await convertICPtoUSD(quote.price)
    : quote.price;

  console.log(`Quote: ${quote.price} ${quote.currency} -> ${priceUsd} USD`);

  const metadata: Record<string, number | string> = {
    request: userRequest,
  };
    
  const jobId = Number(quote.job_id);
  if (!isNaN(jobId) && jobId > 0) {
    metadata.job_id = jobId;
  }
  
  const isLocalhost = ENV.host.includes('localhost');
  
  const config: ICPayConfig = {
    publishableKey,
    priceUsd,
    ...(isLocalhost && { icHost: ENV.host }),
    chainTypes: ['ic'],
    tokenShortcodes: ['ic_icp', 'ic_ckusdc'],
    progressBar: {
      enabled: true,
    },
    // Theme configuration
    theme: {
      primaryColor: '#0ea5e9',
    },
    // Wallet configuration - ensure Plug is enabled
    plugNPlay: {
      enabled: true,
      adapters: {
        plug: { enabled: true },
        oisy: { enabled: true },
        ii: { enabled: true },
        nfid: { enabled: true },
      },
    },
    // Open Oisy in new tab to avoid popup issues
    openOisyInNewTab: true,
    debug: true,
    timeout: 120000,
    metadata,
  };

  console.log("Creating ICPay config... done");
  return config;
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
  console.error("Payment error type:", typeof error);
  console.error("Payment error stringified:", JSON.stringify(error, null, 2));
  
  let errorMessage = 'Payment failed. Please try again.';
  
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: string }).message;
    
    // Provide user-friendly error messages
    if (msg.includes('Failed to fetch verified ledgers') || msg.includes('401')) {
      errorMessage = 'ICPay authentication failed. Please check your publishable key (PUBLIC_KEY) in your environment variables.';
    } else if (msg.includes('CORS') || msg.includes('Failed to fetch')) {
      errorMessage = 'Network error. Please ensure your Internet Computer replica is running and accessible. If using a wallet, check that the IC replica endpoint is configured correctly.';
    } else if (msg.includes('timeout') || msg.includes('Timeout')) {
      errorMessage = 'Payment timed out. This can happen if the wallet takes too long to respond. Please try again.';
    } else if (msg.includes('rejected') || msg.includes('cancelled') || msg.includes('denied')) {
      errorMessage = 'Payment was cancelled or rejected by the wallet. Please try again if this was unintentional.';
    } else if (msg.includes('insufficient') || msg.includes('balance')) {
      errorMessage = 'Insufficient balance in your wallet. Please ensure you have enough funds and try again.';
    } else {
      errorMessage = `Payment failed: ${msg}`;
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