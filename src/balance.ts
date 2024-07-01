import type { Abi } from "viem";

import type { AnyCell, MapCell, SheetProxy } from "@okcontract/cells";

import type { Address, EVMAddress } from "./address";
import type { LocalRPCSubscriber } from "./local";
import type { EVMType, Network } from "./network";
import { BalanceQuery } from "./query";
import type { ChainType } from "./types";

/**
 * native chain balance
 * @param proxy
 * @param rpc
 * @param addr
 * @param owner
 * @returns
 */
export const nativeBalance = (
  proxy: SheetProxy,
  rpc: LocalRPCSubscriber,
  chain: AnyCell<ChainType>,
  owner: AnyCell<Address<EVMType>>
): MapCell<bigint | null, boolean> => {
  const cell = rpc.get(
    proxy,
    proxy.map(
      [chain, owner],
      (_chain, _owner) =>
        _owner && _chain ? [_chain, BalanceQuery(_owner)] : null,
      "nativeBalance.args"
    ),
    {
      name: "nativeBalance.get"
    }
  );
  return proxy.map(
    [cell],
    (v) =>
      v && "result" in v
        ? // new Rational(
          BigInt(v?.result)
        : null,
    "nativeBalance"
  );
};

/**
 * ERC20 balanceOf.
 * @param proxy
 * @param rpc
 * @param addr
 * @param abi
 * @param owner
 * @returns
 */
export const balanceOf = <N extends Network>(
  proxy: SheetProxy,
  rpc: LocalRPCSubscriber,
  addr: AnyCell<EVMAddress<N>>,
  abi: AnyCell<Abi>, // @todo use Default in Multi
  args: AnyCell<[AnyCell<Address<N>>] | []>
) =>
  rpc.call<[AnyCell<Address<N>>] | [], Network>(
    addr,
    abi,
    proxy.new("balanceOf", "'balanceOf'"), // @todo move to Default
    args
  ) as unknown as MapCell<bigint | null, false>;
