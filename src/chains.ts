import type { Chain } from "./types";

export const ethereum: Chain = {
  currency: "tok:eth",
  explorer: ["https://etherscan.com"],
  id: "ethereum",
  name: "Ethereum Mainnet",
  net: "evm",
  numid: 1n,
  rpc: ["https://eth.llamarpc.com", "https://cloudflare-eth.com"]
};

export const polygon: Chain = {
  currency: "tok:matic",
  explorer: ["https://polygonscan.com"],
  id: "polygon",
  name: "Polygon",
  net: "evm",
  numid: 137n,
  rpc: ["https://polygon.drpc.org	", "https://1rpc.io/matic	"]
};

export const sepolia: Chain = {
  currency: "tok:eth",
  explorer: ["https://sepolia.etherscan.io/"],
  id: "sepolia",
  name: "Ethereum Sepolia Testnet",
  net: "evm",
  numid: 11155111n,
  rpc: ["https://rpc.sepolia.org", "https://1rpc.io/sepolia", ""],
  test: true
};

export const mumbai: Chain = {
  currency: "tok:matic",
  explorer: ["https://mumbai.polygonscan.com/"],
  id: "mumbai",
  name: "Polygon Mumbai Testnet",
  net: "evm",
  numid: 80001n,
  rpc: [
    "https://rpc.ankr.com/polygon_mumbai",
    "https://polygon-mumbai-pokt.nodies.app"
  ],
  test: true
};

export const optimism: Chain = {
  currency: "tok:eth",
  explorer: ["https://optimistic.etherscan.io/"],
  id: "optimism",
  name: "OP Mainnet",
  net: "evm",
  numid: 10n,
  rpc: ["https://mainnet.optimism.io"]
};

export const starknet: Chain = {
  currency: "tok:strk",
  explorer: ["https://starkscan.co/"],
  id: "starknet",
  name: "Starknet Mainnet",
  net: "strk",
  numid: 1n,
  rpc: [
    "https://starknet-mainnet.public.blastapi.io",
    "https://rpc.starknet.lava.build",
    "https://free-rpc.nethermind.io/mainnet-juno"
  ]
};
