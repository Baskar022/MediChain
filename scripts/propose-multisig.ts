import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();

/**
 * propose-multisig.ts
 * Generates and signs proposals for the Safe 2-of-3 Multisig governing FederationRegistry on Sepolia.
 * 
 * Supported Operations:
 * 1. APPROVE: approveInstitution(bytes32 institutionId, uint8 trustLevel)
 * 2. SUSPEND: suspendInstitution(bytes32 institutionId, string reason)
 * 3. REMOVE: removeInstitution(bytes32 institutionId, string reason)
 * 4. ROTATE_KEY: updateGatewayPublicKey(bytes32 institutionId, bytes newKey)
 */

async function main() {
  const args = process.argv.slice(2);
  const action = args[0]?.toUpperCase() || "HELP";

  const safeAddress = process.env.SEPOLIA_SAFE_MULTISIG_ADDRESS;
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

  console.log("=================================================");
  console.log(" Safe 2-of-3 Multisig Governance Proposal Utility");
  console.log(" Network: Ethereum Sepolia (Chain ID: 11155111)");
  console.log(" Safe Multisig Address:", safeAddress || "(NOT_CONFIGURED in .env)");
  console.log("=================================================\n");

  if (action === "HELP") {
    console.log("Usage:");
    console.log("  ts-node scripts/propose-multisig.ts APPROVE <institutionIdHex> <trustLevel 1-5>");
    console.log("  ts-node scripts/propose-multisig.ts SUSPEND <institutionIdHex> <reason>");
    console.log("  ts-node scripts/propose-multisig.ts REMOVE <institutionIdHex> <reason>");
    console.log("  ts-node scripts/propose-multisig.ts ROTATE_KEY <institutionIdHex> <newPublicKeyHex>");
    process.exit(0);
  }

  // Load deployed FederationRegistry address
  const deploymentsPath = path.resolve(process.cwd(), "contracts/deployments/sepolia.json");
  let federationRegistryAddress = "";
  if (fs.existsSync(deploymentsPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    federationRegistryAddress = deployment.contracts?.FederationRegistry || "";
  }

  if (!federationRegistryAddress) {
    console.warn("⚠ Note: contracts/deployments/sepolia.json not found. Using placeholder registry address.");
    federationRegistryAddress = "0x0000000000000000000000000000000000000000";
  }

  // ABI fragments for FederationRegistry governance calls
  const iface = new ethers.Interface([
    "function approveInstitution(bytes32 institutionId, uint8 trustLevel)",
    "function suspendInstitution(bytes32 institutionId, string reason)",
    "function removeInstitution(bytes32 institutionId, string reason)",
    "function updateGatewayPublicKey(bytes32 institutionId, bytes newPublicKey)",
  ]);

  let calldata = "";
  let description = "";

  if (action === "APPROVE") {
    const instId = args[1];
    const trust = parseInt(args[2] || "4", 10);
    if (!instId) {
      console.error("❌ Missing institutionId. Example: APPROVE 0x1234... 4");
      process.exit(1);
    }
    calldata = iface.encodeFunctionData("approveInstitution", [instId, trust]);
    description = `Approve Institution ${instId} with Trust Level ${trust}/5`;
  } else if (action === "SUSPEND") {
    const instId = args[1];
    const reason = args[2] || "Compliance inquiry";
    if (!instId) {
      console.error("❌ Missing institutionId. Example: SUSPEND 0x1234... 'Audit failure'");
      process.exit(1);
    }
    calldata = iface.encodeFunctionData("suspendInstitution", [instId, reason]);
    description = `Suspend Institution ${instId} (Reason: ${reason})`;
  } else if (action === "REMOVE") {
    const instId = args[1];
    const reason = args[2] || "Consortium expulsion";
    if (!instId) {
      console.error("❌ Missing institutionId. Example: REMOVE 0x1234... 'Revoked license'");
      process.exit(1);
    }
    calldata = iface.encodeFunctionData("removeInstitution", [instId, reason]);
    description = `Permanently Remove Institution ${instId} (Reason: ${reason})`;
  } else if (action === "ROTATE_KEY") {
    const instId = args[1];
    const newKey = args[2];
    if (!instId || !newKey) {
      console.error("❌ Missing arguments. Example: ROTATE_KEY 0x1234... 0x04abcd...");
      process.exit(1);
    }
    calldata = iface.encodeFunctionData("updateGatewayPublicKey", [instId, newKey]);
    description = `Rotate Gateway Public Key for Institution ${instId}`;
  } else {
    console.error("Unknown action:", action);
    process.exit(1);
  }

  console.log("Proposal Prepared:");
  console.log("------------------");
  console.log("Target Contract (to):", federationRegistryAddress);
  console.log("Value: 0 ETH");
  console.log("Operation: 0 (Call)");
  console.log("Calldata (data):", calldata);
  console.log("Description:", description);

  console.log("\n=================================================");
  console.log("Safe{Wallet} Web Execution Instructions:");
  console.log("1. Open https://app.safe.global/home?safe=sep:" + (safeAddress || "YOUR_SAFE_ADDRESS"));
  console.log("2. Click 'New Transaction' -> 'Transaction Builder'");
  console.log("3. Enter Recipient Address:", federationRegistryAddress);
  console.log("4. Paste Calldata:", calldata);
  console.log("5. Submit transaction & gather 2 out of 3 signatures from consortium committee.");
  console.log("=================================================");
}

main().catch(console.error);
