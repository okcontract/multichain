import type { TransactionRequest } from "viem";

import type { AnyCell, SheetProxy } from "@okcontract/cells";

import type { LocalRPCSubscriber } from "./local";
import { EstimateGasQuery } from "./query";
import type { ChainType } from "./types";

export const estimateGas = (
  proxy: SheetProxy,
  rpc: LocalRPCSubscriber,
  ch: AnyCell<ChainType>,
  tx: AnyCell<TransactionRequest>
): AnyCell<bigint> => {
  const cell = rpc.get(
    proxy,
    proxy.map(
      [ch, tx],
      (_ch, _tx) => (_tx && _ch ? [_ch, EstimateGasQuery(_tx)] : null),
      "estimateGas.args"
    ),
    { name: "estimateGas.get" }
  );
  return proxy.map(
    [cell],
    (v) => {
      if ("result" in v) return BigInt(v.result);
      if ("error" in v) throw new Error(v.error.message);
      return null;
    },
    "estimateGas"
  );
};
