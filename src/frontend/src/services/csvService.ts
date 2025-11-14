import { backend } from "../../../declarations/backend";

export interface AnalyzeCsvParams {
  file: File;
  preset: string;
  primaryMetric?: string;
  segmentColumn?: string;
  includeVisuals: boolean;
}

// Maximum file size: 150 MB
export const MAX_CSV_SIZE = 150 * 1024 * 1024; // 150 MB in bytes

export const analyzeCsv = async ({
  file,
  preset,
  primaryMetric,
  segmentColumn,
  includeVisuals,
}: AnalyzeCsvParams): Promise<string> => {
  console.log("Starting CSV analysis...", {
    fileName: file.name,
    fileSize: file.size,
    preset,
    primaryMetric,
    segmentColumn,
    includeVisuals,
  });

  if (file.size > MAX_CSV_SIZE) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size of 150 MB.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const csvBytes = new Uint8Array(arrayBuffer);

  console.log("Calling backend.analyze_csv with:", {
    csvBytesLength: csvBytes.length,
    preset,
    primaryMetric: primaryMetric?.trim() || null,
    segmentColumn: segmentColumn?.trim() || null,
    includeVisuals,
  });

  try {
    // In Candid, opt text is represented as [] for None or [string] for Some
    const primaryMetricOpt: [] | [string] = primaryMetric && primaryMetric.trim() 
      ? [primaryMetric.trim()] 
      : [];
    const segmentColumnOpt: [] | [string] = segmentColumn && segmentColumn.trim() 
      ? [segmentColumn.trim()] 
      : [];

    const result = await backend.analyze_csv(
      csvBytes,
      preset,
      primaryMetricOpt,
      segmentColumnOpt,
      includeVisuals
    );

    console.log("Backend analyze_csv result:", result);

    if ("Ok" in result) {
      console.log("CSV analysis successful, result length:", result.Ok.length);
      return result.Ok;
    }

    console.error("CSV analysis failed:", result.Err);
    throw new Error(result.Err);
  } catch (error) {
    console.error("Error in analyzeCsv:", error);
    throw error;
  }
};