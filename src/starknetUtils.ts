import { keccak } from "@scure/starknet";
import { CairoCustomEnum } from "starknet";

export const MASK_250 = 2n ** 250n - 1n; // 2 ** 250 - 1

export function utf8ToArray(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}
export function removeHexPrefix(hex: string): string {
  return hex.replace(/^0x/i, "");
}
export function addHexPrefix(hex: string): string {
  return `0x${removeHexPrefix(hex)}`;
}
export function toHex(number: bigint): string {
  return addHexPrefix(number.toString(16));
}

function keccakHex(str: string): string {
  return addHexPrefix(keccak(utf8ToArray(str)).toString(16));
}

export function starknetKeccak(str: string): bigint {
  const hash = BigInt(keccakHex(str));
  // eslint-disable-next-line no-bitwise
  return hash & MASK_250;
}

export function getSelectorFromName(funcName: string) {
  // sometimes BigInteger pads the hex string with zeros, which is not allowed in the starknet api
  return toHex(starknetKeccak(funcName));
}

export const tuple = (
  ...args: (number | bigint | string | object | boolean)[]
): Record<number, number | bigint | string | object | boolean> => ({ ...args });

// Functions to build CairoCustomEnum for multicall contracts
export function execution(
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  staticEx: {} | undefined,
  ifEqual: number[] | undefined = undefined,
  ifNotEqual: number[] | undefined = undefined
): CairoCustomEnum {
  return new CairoCustomEnum({
    Static: staticEx,
    IfEqual: ifEqual ? tuple(ifEqual[0], ifEqual[1], ifEqual[2]) : undefined,
    IfNotEqual: ifNotEqual
      ? tuple(ifNotEqual[0], ifNotEqual[1], ifNotEqual[2])
      : undefined
  });
}

export function dynamicFelt(
  hardcoded: bigint | string | undefined,
  reference: number[] | undefined = undefined
): CairoCustomEnum {
  return new CairoCustomEnum({
    Hardcoded: hardcoded,
    Reference: reference ? tuple(reference[0], reference[1]) : undefined
  });
}

export function dynamicCallData(
  hardcoded: bigint | string | undefined,
  reference: bigint[] | undefined = undefined,
  arrayReference: bigint[] | undefined = undefined
): CairoCustomEnum {
  return new CairoCustomEnum({
    Hardcoded: hardcoded,
    Reference: reference ? tuple(reference[0], reference[1]) : undefined,
    ArrayReference: arrayReference
      ? tuple(arrayReference[0], arrayReference[1])
      : undefined
  });
}

export function isASCII(str: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
  return /^[\x00-\x7F]*$/.test(str);
}

export function isHex(hex: string): boolean {
  return /^0x[0-9a-f]*$/i.test(hex);
}

export function isDecimalString(str: string): boolean {
  return /^[0-9]*$/i.test(str);
}

export function decodeShortString(str: string): string {
  if (!isASCII(str)) throw new Error(`${str} is not an ASCII string`);
  if (isHex(str)) {
    return removeHexPrefix(str).replace(/.{2}/g, (hex) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    );
  }
  if (isDecimalString(str)) {
    return decodeShortString("0X".concat(BigInt(str).toString(16)));
  }
  throw new Error(`${str} is not Hex or decimal`);
}
