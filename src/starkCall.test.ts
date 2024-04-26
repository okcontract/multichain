import { toHex } from "viem";
import { expect, test } from "vitest";

import { type AnyCell, Sheet, SheetProxy } from "@okcontract/cells";

import { Address, type EVMAddress } from "./address";
import { LocalRPCSubscriber } from "./local";
import { MultiChainRPC } from "./multi";
import { StarkNet, type StarkNetType } from "./network";
import { starkCall } from "./starkCall";
import { decodeShortString } from "./starknetUtils";

const erc20AbiStarknet = [
  {
    name: "openzeppelin::token::erc20::interface::IERC20CamelOnly",
    type: "interface",
    items: [
      {
        name: "totalSupply",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u256"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "balanceOf",
        type: "function",
        inputs: [
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress"
          }
        ],
        outputs: [
          {
            type: "core::integer::u256"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "transferFrom",
        type: "function",
        inputs: [
          {
            name: "sender",
            type: "core::starknet::contract_address::ContractAddress"
          },
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress"
          },
          {
            name: "amount",
            type: "core::integer::u256"
          }
        ],
        outputs: [
          {
            type: "core::bool"
          }
        ],
        state_mutability: "external"
      }
    ]
  },
  {
    name: "openzeppelin::token::erc20::interface::IERC20",
    type: "interface",
    items: [
      {
        name: "name",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::felt252"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "symbol",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::felt252"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "decimals",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u8"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "total_supply",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u256"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "balance_of",
        type: "function",
        inputs: [
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress"
          }
        ],
        outputs: [
          {
            type: "core::integer::u256"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "allowance",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress"
          },
          {
            name: "spender",
            type: "core::starknet::contract_address::ContractAddress"
          }
        ],
        outputs: [
          {
            type: "core::integer::u256"
          }
        ],
        state_mutability: "view"
      },
      {
        name: "transfer",
        type: "function",
        inputs: [
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress"
          },
          {
            name: "amount",
            type: "core::integer::u256"
          }
        ],
        outputs: [
          {
            type: "core::bool"
          }
        ],
        state_mutability: "external"
      },
      {
        name: "transfer_from",
        type: "function",
        inputs: [
          {
            name: "sender",
            type: "core::starknet::contract_address::ContractAddress"
          },
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress"
          },
          {
            name: "amount",
            type: "core::integer::u256"
          }
        ],
        outputs: [
          {
            type: "core::bool"
          }
        ],
        state_mutability: "external"
      },
      {
        name: "approve",
        type: "function",
        inputs: [
          {
            name: "spender",
            type: "core::starknet::contract_address::ContractAddress"
          },
          {
            name: "amount",
            type: "core::integer::u256"
          }
        ],
        outputs: [
          {
            type: "core::bool"
          }
        ],
        state_mutability: "external"
      }
    ]
  }
];

test("starkCall", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const local = new LocalRPCSubscriber(proxy, multi);

  const ethERC20Address: AnyCell<EVMAddress<StarkNetType>> = proxy.new({
    chain: "starknet",
    addr: new Address(
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      StarkNet
    ),
    ty: "c"
  });
  const bal = starkCall(
    local,
    ethERC20Address,
    proxy.new(erc20AbiStarknet),
    proxy.new("balanceOf"),
    proxy.new([
      proxy.new(
        "0x0249331A8fA19D1B507fc1aB9DD3eBE1E795A0095333657cecCF572ac774B211"
      )
    ])
  );

  const res = (await bal.get()) as bigint[];
  expect(res).toHaveLength(1);
  expect(res[0]).toBeGreaterThanOrEqual(0n);
});

test("starknet multicall", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const local = new LocalRPCSubscriber(proxy, multi);

  const ethERC20Address: AnyCell<EVMAddress<StarkNetType>> = proxy.new({
    chain: "starknet",
    addr: new Address(
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      StarkNet
    ),
    ty: "c"
  });
  const bal1 = starkCall(
    local,
    ethERC20Address,
    proxy.new(erc20AbiStarknet),
    proxy.new("symbol"),
    proxy.new([])
  );
  const bal2 = starkCall(
    local,
    ethERC20Address,
    proxy.new(erc20AbiStarknet),
    proxy.new("balanceOf"),
    proxy.new([
      proxy.new(
        "0x0148d0d9f75b52e914877aa9c325e648dd9d535af0097fc3caedf80fdee486ca"
      )
    ])
  );
  expect(await multi._counter("starknet")).toBe(0);

  await proxy.working.wait();

  // only one call
  expect(await multi._counter("starknet")).toBe(1);

  const res1 = await bal1.get();
  expect(decodeShortString(toHex(res1[0]))).toEqual("ETH");
  expect(await bal2.get())[0].toBeGreaterThanOrEqual(0n);
});
