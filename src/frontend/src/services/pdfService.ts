import { backend } from "../../../declarations/backend";
import { CompressionStats } from "@/types/pdf";

export interface PdfCompressionResponse {
  bytes: Uint8Array;
  stats: CompressionStats;
}

// Maximum file size: 1 MB (to ensure compressed result stays under 2 MB IC limit)
export const MAX_PDF_SIZE = 1_000_000; // 1 MB in bytes

export const compressPdf = async (
  file: File,
  quality: number
): Promise<PdfCompressionResponse> => {
  if (file.size > MAX_PDF_SIZE) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size of 1 MB.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);

  const result = await backend.compress_pdf(pdfBytes, quality);
  if ("Ok" in result) {
    const compressed =
      result.Ok instanceof Uint8Array ? result.Ok : new Uint8Array(result.Ok);
    return {
      bytes: compressed,
      stats: {
        originalBytes: file.size,
        compressedBytes: compressed.length,
      },
    };
  }

  throw new Error(result.Err);
};
