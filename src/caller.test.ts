import { expect, test } from "bun:test";
import { type Abi, parseAbi } from "viem";

import { Sheet, SheetProxy } from "@okcontract/cells";
import { Address, type EVMAddress } from "./address";
import { polygon } from "./cache.test";
import { RPC } from "./caller";
import { ethCallQuery } from "./ethCall";
import type { RPCQueryKey } from "./hash";
import { defaultRPCOptions } from "./options";
import { BalanceQuery } from "./query";
import type { RawRPCQuery } from "./types";

const erc20Abi = parseAbi([
  // Read-Only Functions
  "function name() public view returns (string)",
  "function symbol() public view returns (string)",
  "function decimals() public view returns (uint8)",
  "function totalSupply() public view returns (uint256)",
  "function balanceOf(address _owner) public view returns (uint256 balance)",
  "function allowance(address _owner, address _spender) public view returns (uint256 remaining)"
]);

const bal1 = BalanceQuery(
  new Address("0xAee5667c86bf40e873b7e33A59d1E0358cF8eBE5")
);
const bal2 = BalanceQuery(
  new Address("0xd683cbeb396b460e1866c1504ab2661b544d74af")
);

test("caller single balance", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);

  const options = {
    ...defaultRPCOptions(proxy),
    chains: proxy.new({ polygon })
  };
  const rpc = new RPC(proxy, "polygon", options);

  const opts = await rpc._options?.get();
  if (opts instanceof Error) throw opts;

  const [keys, map] = await rpc._keyMap([bal1]);
  const enumerated = rpc._enumerate(keys, map, opts);
  if (enumerated instanceof Error) throw enumerated;
  const [input] = enumerated;
  const output = await rpc.call(input);
  expect(output.length).toBe(1);
  expect(output[0].id).toBe(1);
  // @ts-expect-error not always present
  expect(output[0]?.error).toBeUndefined();
  // @ts-expect-error not always present
  expect(BigInt(output[0]?.result)).toBeGreaterThan(0n);
});

test("caller two balances", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const options = {
    ...defaultRPCOptions(proxy),
    chains: proxy.new({ polygon })
  };
  const rpc = new RPC(proxy, "polygon", options);
  const opts = await rpc._options?.get();
  if (opts instanceof Error) throw opts;

  const [keys, map] = await rpc._keyMap([bal1, bal2]);
  const enumerated = rpc._enumerate(keys, map, opts);
  if (enumerated instanceof Error) throw enumerated;
  const [input] = enumerated;
  const output = await rpc.call(input);
  expect(output.length).toBe(2);
  expect(output[0].id).toBe(1);
  // @ts-expect-error not always present
  expect(output[0]?.error).toBeUndefined();
  expect(output[1].id).toBe(2);
  // @ts-expect-error not always present
  expect(output[1]?.error).toBeUndefined();
  // @ts-expect-error not always present
  expect(BigInt(output[0]?.result)).toBeGreaterThan(0n);
  // @ts-expect-error not always present
  expect(BigInt(output[1]?.result)).toBeGreaterThan(0n);
});

test("rotate rpc on rpc error", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);

  const options = {
    ...defaultRPCOptions(proxy),
    chains: proxy.new({
      polygon: { ...polygon, rpc: ["https://fakerpc.opl", ...polygon.rpc] }
    })
  };
  const rpc = new RPC(proxy, "polygon", options);

  const opts = await rpc._options?.get();
  if (opts instanceof Error) throw opts;

  const [keys, map] = await rpc._keyMap([bal1]);
  const enumerated = rpc._enumerate(keys, map, opts);
  if (enumerated instanceof Error) throw enumerated;
  const [input] = enumerated;

  expect(rpc._current).toBe(0);
  const output = await rpc.call(input);
  expect(rpc._current).toBe(1);
});

test("multicall", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const options = {
    ...defaultRPCOptions(proxy),
    chains: proxy.new({ polygon })
  };
  const rpc = new RPC(proxy, "polygon", options);
  const opts = await rpc._options?.get();
  if (opts instanceof Error) throw opts;

  const erc20ABI = proxy.new(erc20Abi as Abi, "erc20ABI");
  const contract = proxy.new<EVMAddress>(
    {
      addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
      chain: "sepolia",
      ty: "c"
    },
    "usdcContract"
  );
  const query1 = ethCallQuery(
    proxy,
    contract,
    erc20ABI,
    proxy.new("balanceOf"),
    proxy.new([proxy.new("0xa889C78f474a98ce667Db5206f35A9a14e3e027a")])
  );
  const query2 = ethCallQuery(
    proxy,
    contract,
    erc20ABI,
    proxy.new("balanceOf"),
    proxy.new([proxy.new("0xFd6124e4518E290938a35aA434659fD825F516Df")])
  );

  const keyMap = proxy.map([query1, query2], async (q1, q2) => {
    const [keys, map] = await rpc._keyMap([q1[1], q2[1]]);
    return [keys, map] as [RPCQueryKey[], Map<RPCQueryKey, RawRPCQuery>];
  });

  const enumerated = await keyMap
    .map(([keys, map]) => rpc._enumerate(keys, map, opts))
    .get();
  if (enumerated instanceof Error) throw enumerated;
  const [input] = enumerated;

  const output = await rpc.call(input);
  expect(output.length).toBe(1);
  expect(output[0].id).toBe(1);
  // @ts-expect-error not always present
  expect(output[0]?.error).toBeUndefined();
  //@ts-expect-error not always present
  expect(BigInt(output[0]?.result)).toBeDefined();
});
