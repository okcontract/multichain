# multichain: Reactive Blockchain RPC Calls

![CI](https://github.com/okcontract/multichain/actions/workflows/main.yml/badge.svg)
![Coverage Status](https://coveralls.io/repos/github/okcontract/multichain/badge.svg?branch=main)
![size](https://deno.bundlejs.com/badge?q=@okcontract/multichain)

`multichain` is a low-level library that facilitates reactive blockchain RPC
calls, leveraging the [cells](https://github.com/okcontract/cells) library - a
simplified reactive functional library inspired by spreadsheet
functionalities.

## Problem Statement

Decentralized applications (dApps) often face challenges when connecting to
blockchain RPCs due to asynchronous operations that result in significant
delays. Common issues include:

1. Difficulty in implementing `multicall` aggregation to optimize RPC calls.
2. Lack of default mechanisms for retrying or dispatching calls to multiple
   RPC nodes.
3. Inefficient caching of immutable data, leading to unnecessary re-queries.
4. The complexity of integrating reactive, functional programming with
   existing imperative libraries.

## Solution

`multichain` addresses these challenges by providing a multi-chain cache for
RPC queries and their responses, built around reactive functional programming
principles. Each response is treated as a _cell_, allowing predefined
computational flows that execute automatically when the data becomes
available.

## Quick Start

Here's how you can set up and use `multichain`:

### Setup

```typescript
// Import necessary modules
import { Sheet } from "@okcontract/cells";
import {
  MultiChainRPC,
  LocalRPCSubscriber,
  Address,
  EVMAddress,
} from "@okcontract/multichain";

// Create a cells proxy
const proxy = new Sheet().newProxy();

// Initialize a multichain instance
const multi = new MultiChainRPC(proxy);
// Initialize a local instance -- doing reference counting
const local = new LocalRPCSubscriber(proxy, multi);

// Create cells for ABI, contract, method, and args
const abi = proxy.new(parseAbi(["..."]));
const contract = proxy.new<EVMAddress>({
  addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
  chain: "sepolia",
});
const method = proxy.new("fake");
const args = proxy.new([]);
```

### Fetch and react to RPC data

Use `local.call` to retrieve a reactive _cell_:

```ts
const data = local.call(contract, abi, method, args);
const next = data.map(v => ...)
args.set(["new..."]); // Update arguments and recompute automatically data, next, etc.
```

There are options to set the data validity, e.g. query every 30 sec, or define
a specific number of retries.

### Additional Query Support

`multichain` extends its functionality beyond function calls to:

- `getTransactionReceipt`: Retrieves the receipt of a transaction, providing
  critical details like status, gas used, and logs.
- `estimateGas`: Estimates the gas needed for a transaction before it's
  executed on the blockchain.
- `getBalance`: Fetches the balance of an account at a given block number.
- `blockNumber`: Returns the number of the most recent block in the chain.

Our support for RPC methods will keep expanding: Keep an eye on our release
notes and community channels for the latest updates and added query support.

## Extended Support: EVM and Starknet

In addition to Ethereum and EVM-compatible networks, `multichain` natively
supports [Starknet](https://www.starknet.io/) calls, enabling seamless queries
across different blockchain networks.

There is no difference in the call, just make sure that both `contract` and
`abi` match a Starknet contract:

```ts
// Contract is a Starknet Address
const contract = proxy.new({
    chain: "starknet",
    addr: new Address(
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      StarkNet
    )
  });
// Starknet ABI
const abi = proxy.new(...)
...
const value = local.call(contract, abi, method, args);
```

# Design & Philosophy

`multichain` is crafted to offer fine-grained control for developers and dApp
implementors, with plans to release a higher-level consumer interface to
simplify rapid dApp development.

We aim for ease of use and correction, so chasing down any bug is our top
priority.

# Contributing

Contributions are welcome! For minor fixes, please feel free to submit a pull
request. For significant changes, kindly discuss with us via
[Discord](https://discord.gg/Ns45RTUXka) or
[Twitter](https://x.com/okcontract) before proceeding.

# License & Support

`multichain` is developed by [OKcontract](https://okcontract.com) and is
released under the Apache license. The project is supported by a strategic
partnership with [Starknet](https://starknet.io).
