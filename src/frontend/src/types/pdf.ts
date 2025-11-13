export type CompressPdfResult =
  | {
      Ok: Uint8Array;
    }
  | {
      Err: string;
    };

export interface CompressionStats {
  originalBytes: number;
  compressedBytes: number;
}