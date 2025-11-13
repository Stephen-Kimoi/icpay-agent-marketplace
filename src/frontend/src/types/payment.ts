export type PaymentState =
  | "idle"
  | "quoted"
  | "waiting_for_payment"
  | "executing"
  | "completed"
  | "error";

export interface Quote {
  price: number;
  currency: string;
  job_id: string;
}

export interface PaymentResult {
  transactionId: string;
  success: boolean;
}

export interface JobResult {
  job_id: string;
  output: string;
  completed_at: bigint;
}