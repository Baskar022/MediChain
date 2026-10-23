import { ethers } from "ethers";
import { CONTRACT_ABIS } from "./abis";

export const CONTRACT_ADDRESSES = {
  HospitalRegistry:
    process.env.NEXT_PUBLIC_HOSPITAL_REGISTRY_ADDRESS ||
    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  AuditLog:
    process.env.NEXT_PUBLIC_AUDIT_LOG_ADDRESS ||
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  RecordRegistry:
    process.env.NEXT_PUBLIC_RECORD_REGISTRY_ADDRESS ||
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  ConsentManager:
    process.env.NEXT_PUBLIC_CONSENT_MANAGER_ADDRESS ||
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
};

export const NETWORK_CONFIG = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
  chainIdHex: "0x7a69", // 31337 in hex
  chainName: "MediChain Local Consortium",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
};

export function getContractInstance(
  contractName: keyof typeof CONTRACT_ADDRESSES,
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  const address = CONTRACT_ADDRESSES[contractName];
  const abi = CONTRACT_ABIS[contractName];
  return new ethers.Contract(address, abi, signerOrProvider);
}
