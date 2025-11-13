import { backend } from "../../../declarations/backend";
import { CompressionStats } from "@/types/pdf";

export interface PdfCompressionResponse {
  bytes: Uint8Array;
  stats: CompressionStats;
}

export const compressPdf = async (
  file: File,
  quality: number
): Promise<PdfCompressionResponse> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);

  const result = await backend.compress_pdf(pdfBytes, quality);
  if ("Ok" in result) {
    const compressed = result.Ok instanceof Uint8Array ? result.Ok : new Uint8Array(result.Ok);
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

