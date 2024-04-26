import type { Abi as StarkAbi } from "starknet";
import type { Abi as ViemAbi } from "viem";

export const EVM = "evm" as const;
export const StarkNet = "strk" as const;
export const Solana = "sol" as const;

export type EVMType = typeof EVM;
export type StarkNetType = typeof StarkNet;
export type SolanaType = typeof Solana;

export type Network = EVMType | StarkNetType | SolanaType;

export type AbiOfNetwork<N extends Network> = N extends EVMType
  ? ViemAbi
  : N extends StarkNetType
    ? StarkAbi
    : ViemAbi;

export type HexString = `0x${string}`;

type Character =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z"
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

// @todo Simplification as otherwise it exceeds TypeScript abilities, awaiting
// support for Regex or at least character repetition.
type AlphaIdentifier = `${Character}${Character}${string}`;

export type RawAddress<N extends Network> = N extends
  | typeof EVM
  | typeof StarkNet
  ? HexString
  : N extends typeof Solana
    ? AlphaIdentifier
    : never;
