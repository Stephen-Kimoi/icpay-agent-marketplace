import { backend } from "../../../declarations/backend";
import { Quote } from "@/types/quote";

export const getQuote = async (request: string): Promise<Quote> => {
  const result = await backend.get_quote(request);
  if ('Ok' in result) {
    return result.Ok;
  } else {
    throw new Error(result.Err);
  }
};