"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { NETWORK_CONFIG, getContractInstance } from "@/lib/contracts/config";

export type UserRole = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN" | "VERIFIER";

export interface ToastNotification {
  id: string;
  type: "info" | "pending" | "success" | "error";
  title: string;
  message?: string;
  txHash?: string;
}

export interface DemoAccount {
  name: string;
  role: UserRole;
  address: string;
  label: string;
}

export interface SovereignNetwork {
  id: string;
  name: string;
  institution: string;
  type: "EVM" | "ALGORAND" | "PERMISSIONED_LEDGER";
  chainId?: number;
  port?: number;
  rpcUrl: string;
  badgeLabel: string;
}

export const DEMO_KEYS: Record<string, string> = {
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Admin
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Hospital A
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Dr. Sarah Chen
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906": "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Alice Vance
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65": "0x47e179ec340f61711fce9740283048c6718497f43b9671100e47ab2461478974", // St. Jude Hospital
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc": "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // Auditor
};

export const SOVEREIGN_NETWORKS: SovereignNetwork[] = [
  {
    id: "sepolia",
    name: "Ethereum Sepolia (Hospital 1)",
    institution: "City General Hospital & Federation Hub",
    type: "EVM",
    chainId: 11155111,
    port: 8545,
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    badgeLabel: "Sepolia TestNet (11155111)",
  },
  {
    id: "amoy",
    name: "Polygon Amoy (Hospital 2)",
    institution: "Regional Specialty Hospital",
    type: "EVM",
    chainId: 80002,
    port: 8546,
    rpcUrl: "https://rpc-amoy.polygon.technology",
    badgeLabel: "Amoy TestNet (80002)",
  },
  {
    id: "algorand-testnet",
    name: "Algorand TestNet (Diagnostic Lab)",
    institution: "Metro Diagnostics Laboratory",
    type: "ALGORAND",
    port: 4001,
    rpcUrl: "https://testnet-api.algonode.cloud",
    badgeLabel: "Algorand TestNet (416002)",
  },
  {
    id: "network-a",
    name: "City General Hospital (Local)",
    institution: "City General Hospital",
    type: "EVM",
    chainId: 31337,
    port: 8545,
    rpcUrl: "http://127.0.0.1:8545",
    badgeLabel: "Local Node A (31337)",
  },
  {
    id: "network-b",
    name: "Regional Specialty (Local)",
    institution: "Regional Specialty Hospital",
    type: "EVM",
    chainId: 31338,
    port: 8546,
    rpcUrl: "http://127.0.0.1:8546",
    badgeLabel: "Local Node B (31338)",
  },
];

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Consortium Admin",
    role: "ADMIN",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    label: "Root authority / Contract deployer",
  },
  {
    name: "Metro Health Hospital",
    role: "HOSPITAL",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    label: "Issuing hospital authority",
  },
  {
    name: "Dr. Sarah Chen",
    role: "DOCTOR",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    label: "Cardiologist (Metro Health)",
  },
  {
    name: "Alice Vance",
    role: "PATIENT",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    label: "Record owner (Patient)",
  },
  {
    name: "St. Jude Hospital",
    role: "HOSPITAL",
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    label: "Consulting / Recipient hospital",
  },
  {
    name: "Auditor / Verifier",
    role: "VERIFIER",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    label: "Public authenticity auditor",
  },
];

interface Web3ContextValue {
  account: string | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  chainId: number | null;
  activeNetwork: SovereignNetwork;
  setActiveNetwork: (network: SovereignNetwork) => void;
  isConnecting: boolean;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  signer: ethers.Signer | null;
  authToken: string | null;
  isAuthenticated: boolean;
  toasts: ToastNotification[];
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signInWithEthereum: () => Promise<boolean>;
  selectDemoAccount: (account: DemoAccount) => void;
  showToast: (toast: Omit<ToastNotification, "id">) => void;
  notify: (type: "info" | "pending" | "success" | "error", title: string, message?: string, txHash?: string) => void;
  dismissToast: (id: string) => void;
  getContract: (name: "HospitalRegistry" | "AuditLog" | "RecordRegistry" | "ConsentManager") => ethers.Contract | null;
}

const Web3Context = createContext<Web3ContextValue | undefined>(undefined);

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("PATIENT");
  const [chainId, setChainId] = useState<number | null>(null);
  const [activeNetwork, setActiveNetwork] = useState<SovereignNetwork>(SOVEREIGN_NETWORKS[0]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Initialize Web3 provider
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      setProvider(browserProvider);

      (window as any).ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
          setSigner(null);
          setAuthToken(null);
        }
      });

      (window as any).ethereum.on("chainChanged", (hexChainId: string) => {
        setChainId(parseInt(hexChainId, 16));
      });
    } else {
      // Fallback RPC provider for read-only access (with static network to prevent background retry spam)
      try {
        const net = new ethers.Network(NETWORK_CONFIG.chainName, NETWORK_CONFIG.chainId);
        const rpcProvider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl, net, { staticNetwork: true });
        setProvider(rpcProvider);
      } catch {
        // Silent fallback without retry error
      }
    }

    const savedToken = localStorage.getItem("medichain_jwt");
    const savedAccount = localStorage.getItem("medichain_account");
    const savedRole = localStorage.getItem("medichain_role") as UserRole;

    if (savedToken) setAuthToken(savedToken);
    if (savedAccount) setAccount(savedAccount);
    if (savedRole) setRole(savedRole);
  }, []);

  const showToast = useCallback((toast: Omit<ToastNotification, "id">) => {
    const id = "toast_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { ...toast, id }]);

    if (toast.type !== "pending") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    }
  }, []);

  const notify = useCallback(
    (type: "info" | "pending" | "success" | "error", title: string, message?: string, txHash?: string) => {
      showToast({ type, title, message, txHash });
    },
    [showToast]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const connectWallet = async () => {
    if (typeof window === "undefined") return;
    setIsConnecting(true);

    try {
      if ((window as any).ethereum) {
        const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await browserProvider.send("eth_requestAccounts", []);
        const network = await browserProvider.getNetwork();

        // Check chainId and prompt switch if needed
        if (Number(network.chainId) !== NETWORK_CONFIG.chainId) {
          try {
            await (window as any).ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: NETWORK_CONFIG.chainIdHex }],
            });
          } catch (switchErr: any) {
            // Network 31337 might need to be added
            if (switchErr.code === 4902) {
              await (window as any).ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: NETWORK_CONFIG.chainIdHex,
                    chainName: NETWORK_CONFIG.chainName,
                    rpcUrls: [NETWORK_CONFIG.rpcUrl],
                    nativeCurrency: NETWORK_CONFIG.nativeCurrency,
                  },
                ],
              });
            }
          }
        }

        const walletSigner = await browserProvider.getSigner();
        setProvider(browserProvider);
        setSigner(walletSigner);
        setAccount(accounts[0]);
        setChainId(Number(network.chainId));

        localStorage.setItem("medichain_account", accounts[0]);

        showToast({
          type: "success",
          title: "Wallet Connected",
          message: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        });
      } else {
        // Fallback for presentation demo when MetaMask is not present in browser
        const demo = DEMO_ACCOUNTS[3]; // Alice Vance (Patient)
        selectDemoAccount(demo);
        showToast({
          type: "info",
          title: "Demo Mode Active",
          message: "MetaMask not detected. Activated local simulated wallet for demo.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Connection Failed",
        message: err.message || "Failed to connect wallet",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const signInWithEthereum = async (): Promise<boolean> => {
    if (!account) {
      await connectWallet();
    }
    if (!account) return false;

    try {
      showToast({
        type: "pending",
        title: "Authenticating",
        message: "Requesting challenge signature via wallet...",
      });

      // 1. Get nonce challenge from server
      const res = await fetch(`/api/auth/nonce?address=${account}`);
      if (!res.ok) throw new Error("Failed to obtain authentication nonce");
      const challenge = await res.json();

      let signature = "";
      if (signer) {
        signature = await signer.signMessage(challenge.message);
      } else if (account && DEMO_KEYS[account.toLowerCase()]) {
        // Authenticate with deterministic demo account private key
        const demoWallet = new ethers.Wallet(DEMO_KEYS[account.toLowerCase()]);
        signature = await demoWallet.signMessage(challenge.message);
      } else {
        // Fallback random mock signature
        const mockWallet = ethers.Wallet.createRandom();
        signature = await mockWallet.signMessage(challenge.message);
      }

      // 2. Verify signature with server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: account,
          message: challenge.message,
          signature,
          role,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.token) {
        throw new Error(verifyData.error || "Authentication verification failed");
      }

      setAuthToken(verifyData.token);
      localStorage.setItem("medichain_jwt", verifyData.token);

      showToast({
        type: "success",
        title: "Authenticated",
        message: `Signed in as ${role} (${account.slice(0, 6)}...${account.slice(-4)})`,
      });

      return true;
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Authentication Failed",
        message: err.message || "Sign-In with Ethereum failed",
      });
      return false;
    }
  };

  const selectDemoAccount = (demo: DemoAccount) => {
    setAccount(demo.address);
    setRole(demo.role);
    localStorage.setItem("medichain_account", demo.address);
    localStorage.setItem("medichain_role", demo.role);

    // Create a local JsonRpcSigner if available on local Hardhat node
    if (provider instanceof ethers.JsonRpcProvider) {
      provider.getSigner(demo.address).then((s) => setSigner(s)).catch(() => {});
    }

    showToast({
      type: "info",
      title: `Switched to ${demo.name}`,
      message: `Role: ${demo.role} • ${demo.label}`,
    });
  };

  const disconnectWallet = () => {
    setAccount(null);
    setSigner(null);
    setAuthToken(null);
    localStorage.removeItem("medichain_account");
    localStorage.removeItem("medichain_jwt");
    localStorage.removeItem("medichain_role");

    showToast({
      type: "info",
      title: "Disconnected",
      message: "Wallet session cleared.",
    });
  };

  const getContract = (name: "HospitalRegistry" | "AuditLog" | "RecordRegistry" | "ConsentManager") => {
    const active = signer || provider;
    if (!active) return null;
    return getContractInstance(name, active);
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        role,
        setRole: (newRole) => {
          setRole(newRole);
          localStorage.setItem("medichain_role", newRole);
        },
        chainId,
        activeNetwork,
        setActiveNetwork: (net: SovereignNetwork) => {
          setActiveNetwork(net);
          localStorage.setItem("medichain_network_id", net.id);
          notify("info", `Switched Network: ${net.name}`, `Connected to ${net.badgeLabel} on port ${net.port}`);
        },
        isConnecting,
        provider,
        signer,
        authToken,
        isAuthenticated: !!authToken,
        toasts,
        connectWallet,
        disconnectWallet,
        signInWithEthereum,
        selectDemoAccount,
        showToast,
        notify,
        dismissToast,
        getContract,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}
