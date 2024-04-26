import { EVM } from "./network";
import type { Chain } from "./types";

export type RpcUrlObject = {
  http: string[];
  webSocket?: string[];
};

export type BlockExplorerObject = {
  name: string;
  url: string;
};

export type ContractObject = {
  address: string;
  blockCreated?: number;
};

export interface ViemChain {
  readonly id: number;
  readonly network: string;
  readonly name: string;
  readonly nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  readonly rpcUrls: {
    default: RpcUrlObject;
    [key: string]: RpcUrlObject;
  };
  readonly blockExplorers: {
    default: BlockExplorerObject;
    [key: string]: BlockExplorerObject;
  };
  readonly contracts: {
    [key: string]: ContractObject;
  };
}

export const currencyToViem = (cq: `tok:${string}`, dec = 18) => ({
  name: cq.replace("tok:", ""), // @todo
  symbol: cq.replace("tok:", "").toUpperCase(),
  decimals: dec
});

/**
 * chainToView generates a chain definition compatible with Viem.
 * @see https://www.multicall3.com/deployments (100+ chains supported)
 */
export const chainToViem = (ch: Chain, multicall = false): ViemChain =>
  ch.net === EVM
    ? {
        id: Number(ch.numid),
        network: ch.id, // @todo might differ
        name: ch.name,
        nativeCurrency: currencyToViem(ch.currency),
        rpcUrls: {
          default: {
            http: ch.rpc,
            webSocket: [] // @todo
          }
        },
        blockExplorers: {
          default: {
            name: "default",
            url: ch.explorer?.[0]
          }
        },
        // @todo might differ
        contracts: multicall
          ? {
              multicall3: {
                address: "0xca11bde05977b3631167028862be2a173976ca11"
              }
            }
          : {}
      }
    : null;
