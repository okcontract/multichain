import type { RPCErrorResult, RPCQuery, RPCResult } from "./types";

export const getError = (res: RPCResult<RPCQuery> | RPCErrorResult<RPCQuery>) =>
  "error" in res && res?.error;

export const isErrorResult = (
  res: RPCResult<RPCQuery> | RPCErrorResult<RPCQuery>
): res is RPCErrorResult<RPCQuery> => !!getError(res);
