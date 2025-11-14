use ic_llm::Model;

#[derive(Clone, Debug)]
pub struct AnalysisOptions {
    pub preset: String,
    pub primary_metric: Option<String>,
    pub segment_column: Option<String>,
    pub include_visuals: bool,
}

impl AnalysisOptions {
    pub fn new(
        preset: String,
        primary_metric: Option<String>,
        segment_column: Option<String>,
        include_visuals: bool,
    ) -> Self {
        Self {
            preset,
            primary_metric,
            segment_column,
            include_visuals,
        }
    }
}

pub struct CsvAnalyzer {
    options: AnalysisOptions,
}

impl CsvAnalyzer {
    pub fn new(options: AnalysisOptions) -> Self {
        Self { options }
    }

    /// Analyze CSV data and generate insights
    pub async fn analyze(&self, csv_data: &[u8]) -> Result<String, String> {
        if csv_data.is_empty() {
            return Err("CSV data cannot be empty".to_string());
        }

        // Validate CSV size (150 MB max)
        if csv_data.len() > 150 * 1024 * 1024 {
            return Err("CSV file exceeds maximum size of 150 MB".to_string());
        }

        // Parse CSV to get a preview and structure
        let csv_string = String::from_utf8(csv_data.to_vec())
            .map_err(|e| format!("Failed to parse CSV as UTF-8: {}", e))?;

        // Extract first few rows for context
        let preview = self.extract_preview(&csv_string);
        let structure = self.analyze_structure(&csv_string);

        // Build the prompt based on preset and options
        let prompt = self.build_prompt(&preview, &structure);

        ic_cdk::println!(
            "Analyzing CSV with preset: {}, include_visuals: {}, preview length: {}, structure: {}",
            self.options.preset,
            self.options.include_visuals,
            preview.len(),
            structure
        );
        
        ic_cdk::println!("Prompt length: {}", prompt.len());
        ic_cdk::println!("Prompt preview (first 500 chars): {}", &prompt.chars().take(500).collect::<String>());

        // Call LLM to generate analysis
        ic_cdk::println!("Calling LLM...");
        let analysis = ic_llm::prompt(Model::Qwen3_32B, &prompt).await;
        ic_cdk::println!("LLM response length: {}", analysis.len());
        
        if analysis.is_empty() {
            ic_cdk::println!("WARNING: LLM returned empty response");
            return Err("LLM returned an empty analysis. Please try again.".to_string());
        }

        ic_cdk::println!("Analysis generated successfully, length: {}", analysis.len());
        Ok(analysis)
    }

    fn extract_preview(&self, csv: &str) -> String {
        // Extract first 10 rows for context
        csv.lines()
            .take(10)
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn analyze_structure(&self, csv: &str) -> String {
        // Analyze CSV structure: headers, row count, column count
        let lines: Vec<&str> = csv.lines().collect();
        if lines.is_empty() {
            return "Empty CSV file".to_string();
        }

        let headers = lines[0];
        let column_count = headers.split(',').count();
        let row_count = lines.len().saturating_sub(1); // Exclude header

        format!(
            "Rows: {}, Columns: {}, Headers: {}",
            row_count, column_count, headers
        )
    }

    fn build_prompt(&self, preview: &str, structure: &str) -> String {
        let preset_instructions = match self.options.preset.as_str() {
            "Trends" => {
                "Identify key movements, patterns, and correlated variables in the data. \
                Highlight significant trends, growth patterns, and relationships between variables. \
                Focus on actionable insights that reveal important changes over time or across segments."
            }
            "Anomalies" => {
                "Surface outliers, unusual behavior, and data points that deviate significantly from expected patterns. \
                Identify potential errors, fraud indicators, or exceptional cases that require attention. \
                Provide context for why these anomalies are significant."
            }
            "Forecast" => {
                "Project future values using statistical baselines and trend analysis. \
                Provide forecasts with confidence intervals and assumptions. \
                Identify key drivers that will influence future outcomes and potential scenarios."
            }
            "Summary" => {
                "Generate a digestible executive summary ready for stakeholders. \
                Highlight key metrics, important findings, and actionable recommendations. \
                Structure the summary for easy consumption by non-technical audiences."
            }
            _ => {
                "Analyze the dataset and provide comprehensive insights covering trends, patterns, and key findings."
            }
        };

        let metric_instruction = if let Some(ref metric) = self.options.primary_metric {
            format!("\n\nPRIMARY METRIC COLUMN: Focus analysis on the '{}' column as the primary metric.", metric)
        } else {
            String::new()
        };

        let segment_instruction = if let Some(ref segment) = self.options.segment_column {
            format!("\n\nSEGMENT/GROUP COLUMN: Analyze data segmented by the '{}' column.", segment)
        } else {
            String::new()
        };

        let visuals_instruction = if self.options.include_visuals {
            "\n\nVISUALIZATIONS: Include descriptions of recommended visualizations and charts that would help illustrate the findings. Describe what types of charts (bar, line, scatter, etc.) would be most effective for different insights."
        } else {
            ""
        };

        format!(
            "You are an expert data analyst. Your task is to analyze the following CSV dataset and provide insights based on the specified analysis objective.\n\n\
            ANALYSIS OBJECTIVE: {}\n\n\
            {}\n\n\
            CSV STRUCTURE:\n{}\n\n\
            CSV PREVIEW (first 10 rows):\n{}\n\n\
            {}{}{}\n\n\
            Please provide a comprehensive analysis that:\n\
            1. Addresses the specific analysis objective\n\
            2. Identifies key patterns, trends, or anomalies\n\
            3. Provides actionable insights and recommendations\n\
            4. Uses clear, professional language suitable for stakeholders\n\
            5. Structures findings in a logical, easy-to-follow format\n\n\
            Provide your analysis in markdown format with clear headings and sections.\n\n\
            Analysis:",
            self.options.preset,
            preset_instructions,
            structure,
            preview,
            metric_instruction,
            segment_instruction,
            visuals_instruction
        )
    }
}