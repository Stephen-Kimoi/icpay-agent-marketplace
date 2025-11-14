import { backend } from "../../../declarations/backend";

export interface SummarizeTextParams {
  text: string;
  tone: string;
  includeQuotes: boolean;
}

export const MAX_TEXT_LENGTH = 50_000; // 50,000 characters max

export const summarizeText = async ({
  text,
  tone,
  includeQuotes,
}: SummarizeTextParams): Promise<string> => {
  if (!text.trim()) {
    throw new Error("Text cannot be empty");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Text length (${text.length} characters) exceeds maximum allowed length of ${MAX_TEXT_LENGTH} characters.`
    );
  }

  const result = await backend.summarize_text(text, tone, includeQuotes);
  if ("Ok" in result) {
    return result.Ok;
  }

  throw new Error(result.Err);
};