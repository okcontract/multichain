import { jsonStringify } from "@okcontract/cells";

import { RawRPCQueryForHash } from "./query";
import type { RawRPCQuery } from "./types";

export type RPCQueryKey = string;

const bufferToHex = (buffer: ArrayBuffer): RPCQueryKey =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const computeHash = async (
  query: RawRPCQuery,
  options: { removeExtraParams: boolean } = { removeExtraParams: true }
): Promise<RPCQueryKey> => {
  const jsonString = jsonStringify(RawRPCQueryForHash(query, options));
  const uint8Array = new TextEncoder().encode(jsonString);
  const buf = await crypto.subtle.digest("SHA-256", uint8Array);
  return bufferToHex(buf);
};
