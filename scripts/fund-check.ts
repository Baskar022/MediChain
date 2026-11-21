import { ethers } from "ethers";
import algosdk from "algosdk";
import * as dotenv from "dotenv";
import { normalizeAlgorandMnemonic } from "./algo-tool";

dotenv.config();

async function main() {
  console.log("=================================================");
  console.log(" MediChain Multi-Chain Testnet Funds & Status Audit");
  console.log("=================================================\n");

  const results: any[] = [];

  const sepoliaRpc =
    process.env.SEPOLIA_RPC_URL ||
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com");

  const amoyRpc =
    process.env.AMOY_RPC_URL ||
    (process.env.ALCHEMY_API_KEY
      ? `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://polygon-amoy-bor-rpc.publicnode.com");

  const algoUrl = process.env.ALGORAND_ALGOD_URL || "https://testnet-api.algonode.cloud";
  const algodClient = new algosdk.Algodv2("", algoUrl, 443);

  // 1. Contract Deployer (EVM)
  const deployerKey = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
  if (deployerKey) {
    if (deployerKey.length === 42 && deployerKey.startsWith("0x")) {
      results.push({
        Role: "Contract Deployer",
        Network: "EVM (Sepolia & Amoy)",
        Address: deployerKey,
        Balance: "N/A",
        Status: "INVALID_KEY: Pasted Ethereum public address (42 chars) instead of private key (64 hex chars)",
        FaucetLink: "Export private key from MetaMask/wallet",
      });
    } else {
      try {
        const sepoliaProvider = new ethers.JsonRpcProvider(sepoliaRpc, undefined, { staticNetwork: true });
        const sepoliaWallet = new ethers.Wallet(deployerKey, sepoliaProvider);
        const balance = await sepoliaProvider.getBalance(sepoliaWallet.address);
        const ethBal = parseFloat(ethers.formatEther(balance));

        results.push({
          Role: "Contract Deployer",
          Network: "Ethereum Sepolia (Chain 11155111)",
          Address: sepoliaWallet.address,
          Balance: `${ethBal.toFixed(4)} ETH`,
          Status: ethBal >= 0.01 ? "READY" : "NEEDS_FAUCET (< 0.01 ETH)",
          FaucetLink: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
        });
      } catch (e: any) {
        results.push({
          Role: "Contract Deployer",
          Network: "Ethereum Sepolia",
          Address: "Error querying",
          Balance: "N/A",
          Status: `RPC_ERROR: ${e.message?.slice(0, 40)}`,
          FaucetLink: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
        });
      }

      try {
        const amoyProvider = new ethers.JsonRpcProvider(amoyRpc, undefined, { staticNetwork: true });
        const amoyWallet = new ethers.Wallet(deployerKey, amoyProvider);
        const balance = await amoyProvider.getBalance(amoyWallet.address);
        const polBal = parseFloat(ethers.formatEther(balance));

        results.push({
          Role: "Contract Deployer",
          Network: "Polygon Amoy (Chain 80002)",
          Address: amoyWallet.address,
          Balance: `${polBal.toFixed(4)} POL`,
          Status: polBal >= 0.05 ? "READY" : "NEEDS_FAUCET (< 0.05 POL)",
          FaucetLink: "https://faucet.polygon.technology/",
        });
      } catch (e: any) {
        results.push({
          Role: "Contract Deployer",
          Network: "Polygon Amoy",
          Address: "Error querying",
          Balance: "N/A",
          Status: `RPC_ERROR: ${e.message?.slice(0, 40)}`,
          FaucetLink: "https://faucet.polygon.technology/",
        });
      }
    }
  } else {
    results.push({
      Role: "Contract Deployer",
      Network: "EVM (Sepolia & Amoy)",
      Address: "NOT_SET",
      Balance: "N/A",
      Status: "MISSING_KEY: Set DEPLOYER_PRIVATE_KEY in .env",
      FaucetLink: "Set DEPLOYER_PRIVATE_KEY first",
    });
  }

  // 2. Gateway Relayer (EVM)
  const relayerKey = process.env.RELAYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (relayerKey) {
    try {
      const sepoliaProvider = new ethers.JsonRpcProvider(sepoliaRpc, undefined, { staticNetwork: true });
      const relayerWallet = new ethers.Wallet(relayerKey, sepoliaProvider);
      const balance = await sepoliaProvider.getBalance(relayerWallet.address);
      const ethBal = parseFloat(ethers.formatEther(balance));

      results.push({
        Role: "Gateway Gas Relayer",
        Network: "Ethereum Sepolia (Chain 11155111)",
        Address: relayerWallet.address,
        Balance: `${ethBal.toFixed(4)} ETH`,
        Status: ethBal >= 0.005 ? "READY" : "NEEDS_FAUCET (< 0.005 ETH)",
        FaucetLink: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
      });
    } catch {}

    try {
      const amoyProvider = new ethers.JsonRpcProvider(amoyRpc, undefined, { staticNetwork: true });
      const relayerWallet = new ethers.Wallet(relayerKey, amoyProvider);
      const balance = await amoyProvider.getBalance(relayerWallet.address);
      const polBal = parseFloat(ethers.formatEther(balance));

      results.push({
        Role: "Gateway Gas Relayer",
        Network: "Polygon Amoy (Chain 80002)",
        Address: relayerWallet.address,
        Balance: `${polBal.toFixed(4)} POL`,
        Status: polBal >= 0.01 ? "READY" : "NEEDS_FAUCET (< 0.01 POL)",
        FaucetLink: "https://faucet.polygon.technology/",
      });
    } catch {}
  } else {
    results.push({
      Role: "Gateway Gas Relayer",
      Network: "EVM (Sepolia & Amoy)",
      Address: "NOT_SET",
      Balance: "N/A",
      Status: "OPTIONAL: Set RELAYER_PRIVATE_KEY in .env (defaults to deployer key)",
      FaucetLink: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
    });
  }

  // 3. Algorand Deployer
  const algoDeployerMnemonic = (process.env.ALGORAND_DEPLOYER_MNEMONIC || "").trim();
  if (algoDeployerMnemonic) {
    try {
      const normalized = normalizeAlgorandMnemonic(algoDeployerMnemonic);
      const info = await algodClient.accountInformation(normalized.address).do();
      const algoBal = Number(info.amount || 0) / 1e6;

      results.push({
        Role: "Algorand App Deployer",
        Network: "Algorand TestNet (AVM)",
        Address: normalized.address,
        Balance: `${algoBal.toFixed(4)} ALGO`,
        Status: algoBal >= 0.5 ? "READY" : "NEEDS_FAUCET (< 0.5 ALGO)",
        FaucetLink: `https://bank.testnet.algorand.network/?address=${normalized.address}`,
      });
    } catch (e: any) {
      results.push({
        Role: "Algorand App Deployer",
        Network: "Algorand TestNet",
        Address: "Error querying",
        Balance: "N/A",
        Status: `RPC_ERROR: ${e.message?.slice(0, 45)}`,
        FaucetLink: "https://bank.testnet.algorand.network/",
      });
    }
  } else {
    results.push({
      Role: "Algorand App Deployer",
      Network: "Algorand TestNet (AVM)",
      Address: "NOT_SET",
      Balance: "N/A",
      Status: "MISSING_KEY: Set ALGORAND_DEPLOYER_MNEMONIC in .env",
      FaucetLink: "https://bank.testnet.algorand.network/",
    });
  }

  // 4. Algorand Lab Relayer
  const algoRelayerMnemonic = process.env.ALGORAND_RELAYER_MNEMONIC || process.env.ALGORAND_DEPLOYER_MNEMONIC;
  if (algoRelayerMnemonic) {
    try {
      const account = algosdk.mnemonicToSecretKey(algoRelayerMnemonic);
      const info = await algodClient.accountInformation(account.addr.toString()).do();
      const algoBal = Number(info.amount || 0) / 1e6;

      results.push({
        Role: "Algorand Lab Relayer",
        Network: "Algorand TestNet (AVM)",
        Address: account.addr.toString(),
        Balance: `${algoBal.toFixed(4)} ALGO`,
        Status: algoBal >= 0.1 ? "READY" : "NEEDS_FAUCET (< 0.1 ALGO)",
        FaucetLink: "https://bank.testnet.algorand.network/",
      });
    } catch {}
  }

  console.table(results);
}

main().catch(console.error);
