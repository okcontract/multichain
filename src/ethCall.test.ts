import { expect, test } from "bun:test";

import { type Abi, parseAbi } from "viem";

import { Sheet, SheetProxy, sleep } from "@okcontract/cells";

import { Address, ContractType, type EVMAddress } from "./address";
import { balanceOf } from "./balance";
import { LocalRPCSubscriber } from "./local";
import { MultiChainRPC } from "./multi";

const erc20Abi = parseAbi([
  // Read-Only Functions
  "function name() public view returns (string)",
  "function symbol() public view returns (string)",
  "function decimals() public view returns (uint8)",
  "function totalSupply() public view returns (uint256)",
  "function balanceOf(address _owner) public view returns (uint256 balance)",
  "function allowance(address _owner, address _spender) public view returns (uint256 remaining)"
]);

test("call function", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const local = new LocalRPCSubscriber(proxy, multi);

  const erc20ABI = proxy.new(erc20Abi as Abi, "erc20ABI");
  const usdcContract = proxy.new<EVMAddress>(
    {
      addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
      chain: "sepolia",
      ty: "c"
    },
    "usdcContract"
  );
  const bal1 = balanceOf(
    proxy,
    local,
    usdcContract,
    erc20ABI,
    proxy.new([
      proxy.new(
        new Address("0xa889C78f474a98ce667Db5206f35A9a14e3e027a", "evm")
      )
    ])
  );
  const bal2 = balanceOf(
    proxy,
    local,
    usdcContract,
    erc20ABI,
    proxy.new([
      proxy.new(
        new Address("0xa889C78f474a98ce667Db5206f35A9a14e3e027a", "evm")
      )
    ])
  );
  expect(await multi._counter("sepolia")).toBe(0);
  await sleep(1800);

  expect(await bal1.consolidatedValue).toBeGreaterThan(1000000n);
  expect(await bal2.consolidatedValue).toBeGreaterThan(1000000n);

  // @todo count retries
  expect(await multi._counter("sepolia")).toBeGreaterThanOrEqual(1);

  local.destroy();
});

test("multicall", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const local = new LocalRPCSubscriber(proxy, multi);

  const erc20ABI = proxy.new(erc20Abi as Abi, "erc20ABI");
  const usdcContract = proxy.new<EVMAddress>(
    {
      addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
      chain: "sepolia",
      ty: "c"
    },
    "usdcContract"
  );
  const bal1 = local.call(
    usdcContract,
    erc20ABI,
    proxy.new("balanceOf"),
    proxy.new([
      proxy.new(new Address("0xa889C78f474a98ce667Db5206f35A9a14e3e027a"))
    ])
  );
  const bal2 = local.call(
    usdcContract,
    erc20ABI,
    proxy.new("balanceOf"),
    proxy.new([
      proxy.new(new Address("0xFd6124e4518E290938a35aA434659fD825F516Df"))
    ])
  );
  expect(await multi._counter("sepolia")).toBe(0);

  await proxy.working.wait();

  // only one call
  expect(await multi._counter("sepolia")).toBe(1);
  expect(await bal1.consolidatedValue).toBeDefined();
  expect(await bal2.consolidatedValue).toBeDefined();

  local.destroy();
});

test("query with bad response", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const local = new LocalRPCSubscriber(proxy, multi);

  const fakeABI = proxy.new(
    parseAbi(["function fake() public view returns (string)"]) as Abi,
    "erc20ABI"
  );
  const usdcContract = proxy.new<EVMAddress>(
    {
      addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
      chain: "sepolia",
      ty: "c"
    },
    "usdcContract"
  );
  const res = local.call(
    usdcContract,
    fakeABI,
    proxy.new("fake"),
    proxy.new([])
  );
  expect(await multi._counter("sepolia")).toBe(0);
  await sleep(2000);
  expect(await res.consolidatedValue).toBeNull();
  expect(await multi._counter("sepolia")).toBe(1);
  local.destroy();
});

test(
  "retry",
  async () => {
    const sheet = new Sheet();
    const proxy = new SheetProxy(sheet);
    const multi = new MultiChainRPC(proxy);
    const local = new LocalRPCSubscriber(proxy, multi);

    const fakeABI = proxy.new(
      parseAbi(["function fake() public view returns (string)"]) as Abi,
      "erc20ABI"
    );
    const usdcContract = proxy.new<EVMAddress>(
      {
        addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
        chain: "sepolia",
        ty: "c"
      },
      "usdcContract"
    );
    local.call(
      usdcContract,
      fakeABI,
      proxy.new("fake"),
      proxy.new([]),
      proxy.new({ retry: 1 })
    );
    expect(await multi._counter("sepolia")).toBe(0);
    await sleep(2000);
    expect(await multi._counter("sepolia")).toBe(1);
    await sleep(2000);
    expect(await multi._counter("sepolia")).toBe(2);
    await sleep(2000);
    expect(await multi._counter("sepolia")).toBe(3);

    local.destroy();
  },
  { timeout: 80000 }
);

test(
  "should not retry if response successful",
  async () => {
    const sheet = new Sheet();
    const proxy = new SheetProxy(sheet);
    const multi = new MultiChainRPC(proxy);
    const local = new LocalRPCSubscriber(proxy, multi);

    const erc20ABI = proxy.new(erc20Abi as Abi, "erc20ABI");
    const usdcContract = proxy.new<EVMAddress>(
      {
        addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
        chain: "sepolia",
        ty: "c"
      },
      "usdcContract"
    );
    const balance = local.call(
      usdcContract,
      erc20ABI,
      proxy.new("balanceOf"),
      proxy.new([
        proxy.new(new Address("0xa889C78f474a98ce667Db5206f35A9a14e3e027a"))
      ]),
      proxy.new({ retry: 1 })
    );
    expect(await multi._counter("sepolia")).toBe(0);
    await sleep(2000);
    expect(await multi._counter("sepolia")).toBe(1);

    expect(await balance.consolidatedValue).toBeGreaterThan(1000000n);

    await sleep(2000);
    expect(await multi._counter("sepolia")).toBe(1);
    await sleep(2000);
    expect(await multi._counter("sepolia")).toBe(1);

    expect(await balance.consolidatedValue).toBeGreaterThan(1000000n);
    local.destroy();
  },
  { timeout: 80000 }
);

test("call function with null abi", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const local = new LocalRPCSubscriber(proxy, multi);

  const nullABI = proxy.new(null);
  const daiContract = proxy.new<EVMAddress>(
    {
      addr: new Address("0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"),
      chain: "ethereum",
      ty: ContractType
    },
    "daiContract"
  );
  const wallet = proxy.new(
    [proxy.new(new Address("0xDFd5293D8e347dFe59E90eFd55b2956a1343963d"))],
    "wallet"
  );

  const balanceOf = proxy.new("balanceOf", "balanceOf");
  const balance = local.call(daiContract, nullABI, balanceOf, wallet);
  await expect(balance.consolidatedValue).resolves.toBeNull();

  local.destroy();
});
