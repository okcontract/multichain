# multichain: Reactive blockchain RPC calls

[![CI](https://github.com/okcontract/multichain/actions/workflows/main.yml/badge.svg)](https://github.com/okcontract/multichain/actions?query=branch%3Amain++)
[![Coverage Status](https://coveralls.io/repos/github/okcontract/multichain/badge.svg?branch=main)](https://coveralls.io/github/okcontract/multichain?branch=main)
[![size](https://deno.bundlejs.com/badge?q=@okcontract/multichain)](https://bundlephobia.com/package/@okcontract/multichain)

This package implements low-level reactive blockchain RPC calls using
[cells](https://github.com/okcontract/cells), a simplified reactive functional
library inspired by spreadsheets.

## Problem

dApps (decentralized apps) need to connect to one or more chain RPC, which is
an async operation with often huge delays as the RPC nodes, especially public
are heavily loaded.

This leads to multiple problems:

1. Optimizations such as `multicall` aggregation but it's hard to implement a
   dApp properly so that these calls can actually be aggregated.
2. Retries or dispatch to multiple RPC nodes is also not properly handled by
   default.
3. Some data is immutable but due to poor caching is often re-queried as
   end-users navigate a dApp.
4. Finally, there are numerous benefits of reactive, functional programming
   for consumers the RPC responses but it is cumbersome to integrate with
   existing imperative libraries.

## Solution

This low-level library implements a multi-chain _cache_ of RPC queries and
their associated responses. It is built with reactive functional programming
at the core: Each response is a _cell_ where the computation flow can be
defined in advance and its execution will be deferred until the value is
available automatically.

## Walkthrough

Assuming you use a [cells](https://github.com/okcontract/cells) proxy, you can
easily create:

- a multichain instance
- a local subscriber

and get the value for your RPC query.

```typescript
// create a multichain cache
const multi = new MultiChainRPC(proxy);
// create a local subscriber
const local = new LocalRPCSubscriber(proxy, multi);

// have cells for abi, contract, method and args
const abi = proxy.new(parseAbi(["..."]));
const contract = proxy.new<EVMAddress>({
  addr: new Address("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
  chain: "sepolia",
});
const method = proxy.new("fake");
const args = proxy.new([]);
// get the RPC response for that query
const value = local.call(contract, abi, method, args);
```

The value is reactive (it's a _cell_). Depending on options (e.g. valid for
30sec, given number of retries, etc.), its value will be updated and can be
consumed by any further computation:

```ts
const next = value.map(v => ...)
```

Naturally, arguments are cells and can be updated too:

```ts
args.set(["new..."]);
```

the value will be recomputed automatically.

## Starknet support

`multichain` natively supports [Starknet](https://www.starknet.io/) in
addition to Ethereum and EVMs, enabling dApps to query both networks together.

There is no difference in the call, just make sure that both `contract` and
`abi` match a Starknet contract:

```ts
const contract = proxy.new({
    chain: "starknet",
    addr: new Address(
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      StarkNet
    )
  });
const abi = proxy.new(...)
...
const value = local.call(contract, abi, method, args);
```

# Design & Philosophy

This is a low-level library, providing fine-grained control to library or
precisely crafted dApps implementors. We will release a higher-level consumer
for `multichain` soon, that will be very simple to use to build dApps quickly
and with high assurance.

We aim for ease of use and correction, so chasing down any bug is our top
priority.

# About

`multichain` is built at [OKcontract](https://okcontract.com) and is released
under the Apache license.

Contributors are welcome, feel free to submit PRs directly for small changes.
You can also reach out in our [Discord](https://discord.gg/Ns45RTUXka) or
contact us on [Twitter](https://x.com/okcontract) in advance for larger
contributions.

This work is supported by a strategic partnership from
[Starknet](https://starknet.io).
