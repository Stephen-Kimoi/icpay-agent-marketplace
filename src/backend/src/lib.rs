use candid::{CandidType, Deserialize};
use ic_llm::Model;
use std::cell::RefCell;
use std::collections::HashMap;

mod pdf;
use pdf::PdfCompressor;

mod text_summarizer;
use text_summarizer::{TextSummarizer, SummarizationOptions};

// Types for the API
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Quote {
    pub price: f64,
    pub currency: String,
    pub job_id: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PaymentRequest {
    pub job_id: String,
    pub amount: f64,
    pub currency: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum PaymentStatus {
    Pending,
    Completed,
    Failed,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PaymentInfo {
    pub job_id: String,
    pub status: PaymentStatus,
    pub transaction_id: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct JobRequest {
    pub request: String,
    pub price: f64,
    pub created_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct JobResult {
    pub job_id: String,
    pub output: String,
    pub completed_at: u64,
}

// State management
thread_local! {
    static JOBS: RefCell<HashMap<String, JobRequest>> = RefCell::default();
    static PAYMENTS: RefCell<HashMap<String, PaymentInfo>> = RefCell::default();
    static RESULTS: RefCell<HashMap<String, JobResult>> = RefCell::default();
    static JOB_COUNTER: RefCell<u64> = RefCell::new(0);
    static PDF_UPLOADS: RefCell<HashMap<String, Vec<u8>>> = RefCell::default();
}

// Calculate the cost based on request complexity using AI
async fn calculate_cost(request: &str) -> f64 {
    // Detect if this is a text summarization request
    let is_summarization = request.to_lowercase().contains("summarize");
    
    let (min_price, max_price, default_price) = if is_summarization {
        (0.1, 0.5, 0.3) // Text summarization: 0.1 - 0.5 ICP
    } else {
        (0.1, 2.0, 0.5) // Other requests: 0.1 - 2.0 ICP
    };
    
    let prompt = format!(
        "Evaluate this request and determine a fair price for processing it. Consider the complexity, length, and computational requirements.\n\nIMPORTANT: Respond with ONLY a single decimal number between {} and {}. Do not include any text, explanation, or other characters. Just the number.\n\nRequest: {}\n\nPrice:",
        min_price, max_price, request
    );
    
    ic_cdk::println!("Sending request to LLM: {}", prompt);
    let response = ic_llm::prompt(Model::Qwen3_32B, &prompt).await;
    ic_cdk::println!("LLM response: {}", response);
    
    // Parse the response directly as a float
    let cleaned = response.trim();
    ic_cdk::println!("Cleaned response: {}", cleaned);

    match cleaned.parse::<f64>() {
        Ok(price) if price >= min_price && price <= max_price => {
            ic_cdk::println!("Price {} is within valid range ({}-{})", price, min_price, max_price);
            // Round to 2 decimal places
            (price * 100.0).round() / 100.0
        }
        Ok(price) => {
            // Price out of range, clamp to valid range
            ic_cdk::println!("Price {} out of range, clamping to {}-{}", price, min_price, max_price);
            if price < min_price {
                min_price
            } else {
                max_price
            }
        }
        Err(_) => {
            // Fallback to default price if parsing fails
            ic_cdk::println!("Failed to parse price from LLM response: {}", response);
            default_price
        }
    }
}

fn generate_job_id() -> String {
    let counter = JOB_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        *counter += 1;
        *counter
    });
    format!("job_{:016}", counter)
}

/// Compress a PDF with the provided quality (1-100).
#[ic_cdk::update]
fn compress_pdf(pdf_bytes: Vec<u8>, quality: u8) -> Result<Vec<u8>, String> {
    let quality = quality.clamp(1, 100);
    let compressor = PdfCompressor::new(quality);
    compressor.compress(pdf_bytes)
}

/// Summarize text with the provided tone and options.
#[ic_cdk::update]
async fn summarize_text(
    text: String,
    tone: String,
    include_quotes: bool,
) -> Result<String, String> {
    let options = SummarizationOptions::new(tone, include_quotes);
    let summarizer = TextSummarizer::new(options);
    summarizer.summarize(&text).await
}

/// Get a quote for processing a request
#[ic_cdk::update]
async fn get_quote(request: String) -> Result<Quote, String> {
    ic_cdk::println!("Getting quote for request: {}", request);
    if request.trim().is_empty() {
        ic_cdk::println!("Request cannot be empty");
        return Err("Request cannot be empty".to_string());
    }

    let price = calculate_cost(&request).await;
    ic_cdk::println!("Price: {}", price);
    let job_id = generate_job_id();
    ic_cdk::println!("Job ID: {}", job_id);
    
    // Store the job request
    let job_request = JobRequest {
        request: request.clone(),
        price,
        created_at: ic_cdk::api::time(),
    };

    JOBS.with(|jobs| {
        jobs.borrow_mut().insert(job_id.clone(), job_request);
    });

    Ok(Quote {
        price,
        currency: "ICP".to_string(),
        job_id,
    })
}

/// Initiate payment for a job
#[ic_cdk::update]
async fn initiate_payment(job_id: String) -> Result<PaymentRequest, String> {
    // Check if job exists
    let job = JOBS.with(|jobs| {
        jobs.borrow().get(&job_id).cloned()
    });

    let job = job.ok_or_else(|| "Job not found".to_string())?;

    // Check if payment already exists
    let payment_exists = PAYMENTS.with(|payments| {
        payments.borrow().contains_key(&job_id)
    });

    if payment_exists {
        return Err("Payment already initiated for this job".to_string());
    }

    // Create payment request
    let payment_info = PaymentInfo {
        job_id: job_id.clone(),
        status: PaymentStatus::Pending,
        transaction_id: None,
    };

    PAYMENTS.with(|payments| {
        payments.borrow_mut().insert(job_id.clone(), payment_info);
    });

    Ok(PaymentRequest {
        job_id,
        amount: job.price,
        currency: "ICP".to_string(),
    })
}

/// Check payment status for a job
#[ic_cdk::query]
fn check_payment_status(job_id: String) -> Result<PaymentInfo, String> {
    PAYMENTS.with(|payments| {
        payments.borrow()
            .get(&job_id)
            .cloned()
            .ok_or_else(|| "Payment not found".to_string())
    })
}

/// Complete payment (mock function - in production this would be called by ICPAY SDK callback)
#[ic_cdk::update]
async fn complete_payment(job_id: String, transaction_id: String) -> Result<(), String> {
    PAYMENTS.with(|payments| {
        let mut payments_mut = payments.borrow_mut();
        if let Some(payment) = payments_mut.get_mut(&job_id) {
            payment.status = PaymentStatus::Completed;
            payment.transaction_id = Some(transaction_id);
            Ok(())
        } else {
            Err("Payment not found".to_string())
        }
    })
}

/// Execute the job after payment is confirmed
#[ic_cdk::update]
async fn execute_job(job_id: String) -> Result<JobResult, String> {
    // Check if payment is completed
    let payment = PAYMENTS.with(|payments| {
        payments.borrow()
            .get(&job_id)
            .cloned()
    });

    let payment = payment.ok_or_else(|| "Payment not found".to_string())?;

    match payment.status {
        PaymentStatus::Completed => {
            // Payment is confirmed, proceed with execution
        }
        PaymentStatus::Pending => {
            return Err("Payment not yet completed. Please wait for payment confirmation.".to_string());
        }
        PaymentStatus::Failed => {
            return Err("Payment failed".to_string());
        }
    }

    // Check if job already executed
    let result_exists = RESULTS.with(|results| {
        results.borrow().contains_key(&job_id)
    });

    if result_exists {
        return Err("Job already executed".to_string());
    }

    // Get the job request
    let job = JOBS.with(|jobs| {
        jobs.borrow().get(&job_id).cloned()
    });

    let job = job.ok_or_else(|| "Job not found".to_string())?;

    // Execute using LLM canister
    let output = ic_llm::prompt(Model::Qwen3_32B, &job.request).await;

    // Store the result
    let result = JobResult {
        job_id: job_id.clone(),
        output,
        completed_at: ic_cdk::api::time(),
    };

    RESULTS.with(|results| {
        results.borrow_mut().insert(job_id.clone(), result.clone());
    });

    Ok(result)
}

/// Get job result
#[ic_cdk::query]
fn get_job_result(job_id: String) -> Result<JobResult, String> {
    RESULTS.with(|results| {
        results.borrow()
            .get(&job_id)
            .cloned()
            .ok_or_else(|| "Job result not found".to_string())
    })
}

/// Get all jobs (for debugging/admin)
#[ic_cdk::query]
fn list_jobs() -> Vec<(String, JobRequest)> {
    JOBS.with(|jobs| {
        jobs.borrow().iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    })
}

ic_cdk::export_candid!();