import { isAddress } from "viem";

import type { AnyCell, SheetProxy } from "@okcontract/cells";

import { Address } from "./address";
import {
  ethereum,
  mumbai,
  optimism,
  polygon,
  sepolia,
  starknet
} from "./chains";
import type { MultiChainRPCOptions } from "./multi";
import { EVM, type Network, StarkNet } from "./network";
import type { Chain, ChainType } from "./types";

// @todo type for convert
export type Native = unknown;

export type RPCOptions = {
  now: () => number | Promise<number>;
  chains: AnyCell<{ [key: ChainType]: Chain }>;
  convertToNative: (v: unknown) => unknown;
  convertFromNative: (v: unknown) => unknown;
  loopDelay: number; // in ms
  dev: boolean;
  rateLimit: number;
};

export type ChainRPCOptions = {
  chain: ChainType;
  RPCOptions: RPCOptions;
  multiCall?: Address<Network>;
};

export type AddressRewrite =
  | bigint
  | string
  | Address
  | AddressRewrite[]
  | { [key: string]: AddressRewrite };

const convertToNative = (v: unknown) =>
  Array.isArray(v)
    ? v.map((_v) => convertToNative(_v))
    : v instanceof Address
      ? v.toString()
      : typeof v === "object" && v !== null
        ? Object.fromEntries(
            Object.entries(v).map(([k, _v]) => [k, convertToNative(_v)])
          )
        : v;

const convertFromNative = (obj: unknown) => {
  const aux = (v: unknown) =>
    Array.isArray(v)
      ? v.map((vv) => aux(vv))
      : v instanceof Address
        ? v
        : typeof v === "string" && isAddress(v)
          ? new Address(v)
          : typeof v === "object" && v !== null
            ? Object.fromEntries(
                Object.entries(v).map(([k, vv]) => [k, aux(vv)])
              )
            : v;
  return aux(obj);
};

export const defaultRPCOptions = (proxy: SheetProxy): MultiChainRPCOptions => ({
  now: Date.now, // /1000?
  chains: proxy.new({
    ethereum,
    optimism,
    starknet,
    sepolia,
    polygon,
    mumbai
  }),
  convertToNative: convertToNative,
  convertFromNative: convertFromNative,
  loopDelay: 1000,
  dev: false,
  rateLimit: 1000
});

// cf. https://www.multicall3.com/
// @todo retrieve dynamically from OKcontract
export const multiCall3 = new Address(
  "0xcA11bde05977b3631167028862bE2a173976CA11"
);
const starknetMulticall = new Address(
  "0x034ffb8f4452df7a613a0210824d6414dbadcddce6c6e19bf4ddc9e22ce5f970",
  StarkNet
);
/**
 * chainOptions generates the option for a given chain.
 */
export const chainOptions = <T>(
  RPCOptions: RPCOptions,
  chain: ChainType
): AnyCell<ChainRPCOptions> =>
  RPCOptions.chains.map((_chains) => {
    const def = _chains[chain];
    if (!def) throw new Error(`unknown chain: ${chain}`);
    // @todo double check than the given chain is supported
    const multiCall =
      def.net === EVM
        ? multiCall3
        : def.net === StarkNet
          ? starknetMulticall
          : undefined;
    return {
      chain,
      RPCOptions: RPCOptions,
      multiCall
    };
  }, "chainOptions");
