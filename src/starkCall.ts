import { type Abi, CairoCustomEnum, CallData, type Calldata } from "starknet";

import {
  type AnyCell,
  type MapCell,
  cellify,
  collector,
  uncellify
} from "@okcontract/cells";

import type { Address, EVMAddress } from "./address";
import type { LocalRPCSubscriber } from "./local";
import { mapArrayRec } from "./mapArrayRec";
import type { StarkNetType } from "./network";
import {
  dynamicCallData,
  dynamicFelt,
  getSelectorFromName
} from "./starknetUtils";
import type { ChainType, RPCQuery, RPCResult } from "./types";

export const StarkCall = "starknet_call" as const;

enum BlockTag {
  pending = "pending",
  latest = "latest"
}
type BlockNumberOption = { block_number: bigint };
type BlockHashOption = { block_hash: `0x${string}` };

export type StarkCallQueryType = {
  method: typeof StarkCall;
  params: {
    request: {
      contract_address: `0x${string}`;
      entry_point_selector: string;
      calldata: Calldata;
    };
    block_id: BlockNumberOption | BlockHashOption | BlockTag | null;
  };
  expiry?: number;
  // args must be removed before sending query
  args?: string[] | bigint[];
};
export type StarkCallResult = {
  result: string[];
};

type StarkCallOptions = {
  validity?: number;
  name?: string;
  /**
   * noFail could be set to true to ignore RPC errors.
   */
  noFail?: boolean;
  removeExtraParams?: boolean;
  convertToNative?: (v: unknown) => unknown;
  convertFromNative?: (v: unknown) => unknown;

  block?: BlockNumberOption | BlockHashOption | BlockTag | null;
};

export const starknetMulticallAbi = [
  {
    name: "ComposableMulticallImpl",
    type: "impl",
    interface_name: "composable_multicall::IComposableMulticall"
  },
  {
    name: "composable_multicall::Execution",
    type: "enum",
    variants: [
      {
        name: "Static",
        type: "()"
      },
      {
        name: "IfEqual",
        type: "(core::integer::u32, core::integer::u32, core::felt252)"
      },
      {
        name: "IfNotEqual",
        type: "(core::integer::u32, core::integer::u32, core::felt252)"
      }
    ]
  },
  {
    name: "composable_multicall::DynamicFelt",
    type: "enum",
    variants: [
      {
        name: "Hardcoded",
        type: "core::felt252"
      },
      {
        name: "Reference",
        type: "(core::integer::u32, core::integer::u32)"
      }
    ]
  },
  {
    name: "composable_multicall::DynamicCalldata",
    type: "enum",
    variants: [
      {
        name: "Hardcoded",
        type: "core::felt252"
      },
      {
        name: "Reference",
        type: "(core::integer::u32, core::integer::u32)"
      },
      {
        name: "ArrayReference",
        type: "(core::integer::u32, core::integer::u32)"
      }
    ]
  },
  {
    name: "composable_multicall::DynamicCall",
    type: "struct",
    members: [
      {
        name: "execution",
        type: "composable_multicall::Execution"
      },
      {
        name: "to",
        type: "composable_multicall::DynamicFelt"
      },
      {
        name: "selector",
        type: "composable_multicall::DynamicFelt"
      },
      {
        name: "calldata",
        type: "core::array::Array::<composable_multicall::DynamicCalldata>"
      }
    ]
  },
  {
    name: "core::array::Span::<core::felt252>",
    type: "struct",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::felt252>"
      }
    ]
  },
  {
    name: "composable_multicall::IComposableMulticall",
    type: "interface",
    items: [
      {
        name: "aggregate",
        type: "function",
        inputs: [
          {
            name: "calls",
            type: "core::array::Array::<composable_multicall::DynamicCall>"
          }
        ],
        outputs: [
          {
            type: "core::array::Array::<core::array::Span::<core::felt252>>"
          }
        ],
        state_mutability: "view"
      }
    ]
  },
  {
    kind: "enum",
    name: "composable_multicall::contract::ComposableMulticall::Event",
    type: "event",
    variants: []
  }
];
const callDataMulticall = new CallData(starknetMulticallAbi);
export const starkCall = <
  T extends unknown | unknown[],
  Args extends AnyCell<unknown>[] | null
>(
  local: LocalRPCSubscriber,
  addr: AnyCell<EVMAddress<StarkNetType>>,
  abi: AnyCell<Abi>,
  functionName: AnyCell<string>,
  args: AnyCell<Args>,
  opts: AnyCell<StarkCallOptions> = local._proxy.new(null)
): MapCell<T | null, false> => {
  return opts.map(async (_options) => {
    const proxy = local._proxy;
    const converted = mapArrayRec(
      proxy,
      args,
      _options?.convertToNative || ((v: unknown) => v),
      "starkCall.converted"
    );
    const callData = abi.map((_abi) => new CallData(_abi));
    const query = proxy.map(
      [addr, functionName, callData],
      async (_addr, _method, _callData) =>
        [
          "starknet",
          starkCallQuery(
            _addr.addr,
            _method,
            _callData,
            await uncellify(converted),
            _options
          )
        ] as [string, StarkCallQueryType]
    );

    return callData.map((_callData) =>
      call(_callData, local, query, functionName, _options)
    );
  }, "starkCall");
};

export const call = (
  callData: CallData,
  local: LocalRPCSubscriber,
  query: AnyCell<[ChainType, StarkCallQueryType]>,
  functionName: AnyCell<string>,
  opts?: StarkCallOptions
) => {
  const proxy = local._proxy;
  const cell = local.get(proxy, query, {
    ...opts,
    name: opts?.name
      ? `${opts?.name}.${functionName.id}`
      : `call.cell:${functionName.id}`
  });
  const coll = collector(proxy);
  return proxy.map(
    [cell, functionName],
    (_cell, _functionName) => {
      try {
        if (!_cell || "error" in _cell || !_cell?.result) return null;
        if ("multi" in _cell)
          return coll(
            cellify(
              proxy,
              opts?.convertFromNative(_cell.result) || _cell.result
            )
          );
        const parsed = callData.parse(_functionName, _cell?.result);
        const converted = opts?.convertFromNative(parsed) || parsed;
        return [coll(cellify(proxy, converted))];
      } catch (error) {
        return error;
      }
    },
    `starkCall.call:${functionName.value}`
  );
};

export const starkCallQuery = (
  to: Address<StarkNetType>,
  method: string,
  callData: CallData,
  args = [],
  options?: StarkCallOptions
): StarkCallQueryType => ({
  method: StarkCall,
  params: {
    request: {
      contract_address: to.toString(),
      entry_point_selector: getSelectorFromName(method),
      calldata: callData.compile(method, args)
    },
    block_id: options?.block || ("latest" as BlockTag)
  },
  args
});

export const starkMulticall = (
  addr: Address<StarkNetType>,
  calls: StarkCallQueryType[]
) => {
  const execution = new CairoCustomEnum({ Static: {} });
  const agg = calls.map((call) => ({
    execution: execution,
    to: dynamicFelt(call.params.request.contract_address),
    selector: dynamicFelt(call.params.request.entry_point_selector),
    calldata: call.args.map((_arg) => dynamicCallData(_arg))
  }));
  return starkCallQuery(addr, "aggregate", callDataMulticall, [agg]);
};

export const decodeStarkMultiCall = (
  id: number,
  data: string[]
): RPCResult<RPCQuery>[] => {
  const parsed = callDataMulticall.parse("aggregate", data) as [];
  return parsed.map((result) => ({
    id,
    jsonrpc: "2.0",
    result,
    multi: true
  }));
};
