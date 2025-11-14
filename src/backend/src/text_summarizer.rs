use ic_llm::Model;

#[derive(Clone, Debug)]
pub struct SummarizationOptions {
    pub tone: String,
    pub include_quotes: bool,
}

impl SummarizationOptions {
    pub fn new(tone: String, include_quotes: bool) -> Self {
        Self {
            tone,
            include_quotes,
        }
    }
}

pub struct TextSummarizer {
    options: SummarizationOptions,
}

impl TextSummarizer {
    pub fn new(options: SummarizationOptions) -> Self {
        Self { options }
    }

    /// Generate a summary based on the text and options
    pub async fn summarize(&self, text: &str) -> Result<String, String> {
        if text.trim().is_empty() {
            return Err("Text cannot be empty".to_string());
        }

        // Validate text length (50,000 characters max)
        if text.len() > 50_000 {
            return Err("Text exceeds maximum length of 50,000 characters".to_string());
        }

        // Build the prompt based on tone and options
        let prompt = self.build_prompt(text);
        
        ic_cdk::println!("Generating summary with tone: {}, include_quotes: {}", 
            self.options.tone, self.options.include_quotes);
        
        // Call LLM to generate summary
        let summary = ic_llm::prompt(Model::Qwen3_32B, &prompt).await;
        
        Ok(summary)
    }

    fn build_prompt(&self, text: &str) -> String {
        let tone_instructions = match self.options.tone.as_str() {
            "Executive Summary" => {
                "Create a concise executive summary suitable for leadership and decision-makers. \
                Focus on key decisions, outcomes, and actionable insights. Use clear, professional language \
                and structure the summary with bullet points for easy scanning."
            }
            "Creative Highlights" => {
                "Create an engaging, creative summary that highlights the most interesting and compelling \
                aspects of the content. Use vivid language and focus on storytelling elements. Make it \
                shareable and attention-grabbing while maintaining accuracy."
            }
            "Technical Abstract" => {
                "Create a technical abstract that focuses on methodology, data, and technical details. \
                Use precise terminology and include relevant metrics, specifications, and technical \
                considerations. Structure it for technical audiences."
            }
            "Bullet Digest" => {
                "Create a concise bullet-point digest that captures the essential information in a \
                scannable format. Use short, punchy bullet points. Prioritize the most important \
                information and make it easy to quickly understand the key points."
            }
            _ => {
                "Create a well-structured summary that captures the main points and key information \
                from the content."
            }
        };

        let quotes_instruction = if self.options.include_quotes {
            "Additionally, extract and highlight standout quotes, statistics, and key data points \
            from the content. Present these in a separate section or integrate them prominently \
            within the summary."
        } else {
            ""
        };

        format!(
            "You are an expert content summarizer. Your task is to create a high-quality summary \
            based on the following requirements:\n\n\
            TONE STYLE: {}\n\n\
            {}\n\n\
            CONTENT TO SUMMARIZE:\n{}\n\n\
            Please provide a well-structured summary that:\n\
            1. Captures the main points and key information\n\
            2. Maintains the requested tone and style\n\
            3. Is concise but comprehensive\n\
            4. Uses appropriate formatting (bullet points, headings, etc.)\n\
            {}\n\n\
            Summary:",
            self.options.tone,
            tone_instructions,
            text,
            quotes_instruction
        )
    }
}