import { backend } from "../../../declarations/backend";
import { JobResult } from "@/types/payment";

/**
 * Initiate payment for a job
 * This creates a payment record in the backend with Pending status
 * @param jobId - The job ID to initiate payment for
 * @returns Payment request information
 */
export const initiatePayment = async (jobId: string) => {
  const result = await backend.initiate_payment(jobId);
  if ('Ok' in result) {
    return result.Ok;
  } else {
    throw new Error(result.Err);
  }
};

/**
 * Complete payment by marking it as completed in the backend
 * This should be called after payment success to update the payment status
 * @param jobId - The job ID associated with the payment
 * @param transactionId - The transaction ID from ICPay
 */
export const completePayment = async (
  jobId: string,
  transactionId: string
): Promise<void> => {
  const result = await backend.complete_payment(jobId, transactionId);
  if ('Err' in result) {
    throw new Error(result.Err);
  }
};

/**
 * Execute the job after payment is confirmed
 * @param jobId - The job ID to execute
 * @returns The job result containing the output
 */
export const executeJob = async (jobId: string): Promise<JobResult> => {
  const result = await backend.execute_job(jobId);
  if ('Ok' in result) {
    return result.Ok;
  } else {
    throw new Error(result.Err);
  }
};

/**
 * Get job result by job ID
 * @param jobId - The job ID to get the result for
 * @returns The job result if found
 */
export const getJobResult = async (jobId: string): Promise<JobResult> => {
  const result = await backend.get_job_result(jobId);
  if ('Ok' in result) {
    return result.Ok;
  } else {
    throw new Error(result.Err);
  }
};

/**
 * Check payment status for a job
 * @param jobId - The job ID to check payment status for
 * @returns Payment info including status and transaction ID
 */
export const checkPaymentStatus = async (jobId: string) => {
  const result = await backend.check_payment_status(jobId);
  if ('Ok' in result) {
    return result.Ok;
  } else {
    throw new Error(result.Err);
  }
};

