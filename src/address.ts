import { getAddress } from "viem";

import {
  EVM,
  type EVMType,
  type Network,
  type RawAddress,
  StarkNet,
  type StarkNetType
} from "./network";

/**
 * ChainID is the type of chains.
 */
export type ChainID = string;

export const WalletType = "w" as const;
export const ContractType = "c" as const;
export const SmartAccount = "sa";

/**
 * AddressType defines different types of addresses.
 *
 * If not stored, this information can be queried from the chain (unless, a contract is deleted
 * via a `self destruct`).
 */
export type AddressType =
  | typeof WalletType
  | typeof ContractType
  | typeof SmartAccount;

/**
 * EVMAddress represents an EVM address (either wallet or contract).
 */
export interface EVMAddress<N extends Network = EVMType> {
  /** name (optional) */
  n?: string;
  addr: Address<N>; // | typeof chain_balance; // FIXME: `0x[A-Fa-f0-9]{40}`
  chain: ChainID;
  ty: AddressType;
  /** version (optional) */
  v?: number;
  /** proxy to (optional) */
  px?: Address;
  // sig: string;
}

/**
 * Address is an on-chain address.
 */
export class Address<N extends Network = EVMType> {
  /**
   * @example 0x5f7cd1fd465baff2ba9d2d1501ad0a2eb5337d9a885be319366b5205a414fdd starknet
   * @example 0x9c7a3e3efd0cec787c432535f27de6c755fb4870 evm
   */
  private _addr: RawAddress<N>;
  readonly _network: N;
  /**
   * @todo is the address secure
   * @todo include source/traceability?
   * - verified wallet, signed OKcontract data
   */
  readonly _security: boolean;

  // @todo source/security
  constructor(addr: string | bigint, network: N = EVM as N) {
    // @todo auto-detection
    this._network = network as N;
    if (this._network === EVM)
      this._addr = getAddress(
        typeof addr === "string"
          ? addr
          : `0x${addr.toString(16).padStart(40, "0")}`
      ) as RawAddress<N>;
    else if (this._network === StarkNet)
      this._addr = addr.toString() as RawAddress<N>;
    // @todo formatting, etc.
    else this._addr = addr as RawAddress<N>;
  }
  toString() {
    return this._addr;
  }
  equals(other: Address<N>) {
    return this._addr === other._addr;
  }
  isNull() {
    if (this._network === EVM)
      return this.equals(nullAddrEVM as unknown as Address<N>);
    return false;
  }
  isNative() {
    if (this._network === EVM)
      return this.equals(nativeAddrEVM as unknown as Address<N>);
    if (this._network === StarkNet)
      return this.equals(nativeAddrStarknet as unknown as Address<N>);
    return false;
  }
  substring() {
    console.log({ SUBSTRING: this._addr });
  }
}

/**
 * chain_balance is an older constant.
 * @todo replace with nativeAddr
 */
export const chain_balance = "chain" as const;

/**
 * null address
 */
export const nullAddrEVM: Address<EVMType> = new Address(
  "0x0000000000000000000000000000000000000000"
);

/**
 * virtual address for EVM native chain token
 */
export const nativeAddrEVM: Address<EVMType> = new Address(
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
);

/**
 * virtual address for starknet native chain token
 */
export const nativeAddrStarknet: Address<StarkNetType> = new Address(
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  StarkNet
);

/**
 * isNullAddr checks if an address is the null address.
 * @param addr
 * @returns
 * @description this function accepts null or undefined values as the null address.
 */
export const isNullAddrEVM = (addr: string) =>
  !addr || addr === nullAddrEVM.toString();

export const isNativeAddrEVM = (addr: string) =>
  getAddress(addr) === nativeAddrEVM.toString();

export const isEVMAddr = (
  addr: EVMAddress<Network>
): addr is EVMAddress<EVMType> => addr.addr._network === EVM;

export const isStarknetAddr = (
  addr: EVMAddress<Network>
): addr is EVMAddress<StarkNetType> => addr.addr._network === StarkNet;

/**
 * isRealAddress checks if the address is defined and not the native virtual address.
 * @param addr
 * @returns
 */
export const isRealAddr = <N extends Network>(addr: EVMAddress<N>) =>
  isEVMAddr(addr)
    ? addr && !addr?.addr.equals(nativeAddrEVM)
    : isStarknetAddr(addr)
      ? addr && !addr?.addr.equals(nativeAddrStarknet)
      : false;
