import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment from project root .env or local .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com";
const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

const rawKey = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const isValidPrivateKey = (rawKey.startsWith("0x") && rawKey.length === 66) || (!rawKey.startsWith("0x") && rawKey.length === 64);
const DEPLOYER_PRIVATE_KEY = isValidPrivateKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const accounts = [DEPLOYER_PRIVATE_KEY];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Production Testnet A: Ethereum Sepolia (Hospital 1 & Federation Registry)
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: accounts,
      chainId: 11155111,
      timeout: 60000,
    },
    // Production Testnet B: Polygon Amoy (Hospital 2)
    amoy: {
      url: AMOY_RPC_URL,
      accounts: accounts,
      chainId: 80002,
      timeout: 120000,
    },
    // Fallback EVM Testnet B: Arbitrum Sepolia
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL,
      accounts: accounts,
      chainId: 421614,
      timeout: 60000,
    },
    // Local dev multi-network topology
    networkA: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    networkB: {
      url: "http://127.0.0.1:8546",
      chainId: 31338,
    },
    federation: {
      url: "http://127.0.0.1:8547",
      chainId: 31340,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
