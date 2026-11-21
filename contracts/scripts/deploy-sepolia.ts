import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();

  console.log("=================================================");
  console.log(" MediChain Sovereign Network A Deployment");
  console.log(" Target Network: Ethereum Sepolia (Chain ID:", network.chainId.toString() + ")");
  console.log(" Deployer Account:", deployer.address);
  console.log(" Deployer Balance:", ethers.formatEther(balance), "ETH");
  console.log("=================================================");

  if (balance === 0n) {
    console.warn("⚠ WARNING: Deployer balance is 0 ETH. Deployment will fail without Sepolia testnet faucet funds.");
  }

  // 1. Deploy MinimalForwarder (ERC-2771 Gasless Meta-Transactions)
  console.log("\n[1/8] Deploying MinimalForwarder (ERC-2771)...");
  const Forwarder = await ethers.getContractFactory("MinimalForwarder");
  const forwarder = await Forwarder.deploy();
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  console.log("✔ MinimalForwarder deployed to:", forwarderAddress);

  // 2. Deploy StaffRegistry
  console.log("\n[2/8] Deploying StaffRegistry (Hospital 1 Staff Roles)...");
  const StaffRegistry = await ethers.getContractFactory("StaffRegistry");
  const staffRegistry = await StaffRegistry.deploy(forwarderAddress, deployer.address);
  await staffRegistry.waitForDeployment();
  const staffRegistryAddress = await staffRegistry.getAddress();
  console.log("✔ StaffRegistry deployed to:", staffRegistryAddress);

  // 3. Deploy HospitalRegistry
  console.log("\n[3/8] Deploying HospitalRegistry...");
  const HospitalRegistry = await ethers.getContractFactory("HospitalRegistry");
  const hospitalRegistry = await HospitalRegistry.deploy(deployer.address);
  await hospitalRegistry.waitForDeployment();
  const hospitalRegistryAddress = await hospitalRegistry.getAddress();
  console.log("✔ HospitalRegistry deployed to:", hospitalRegistryAddress);

  // 4. Deploy AuditLog
  console.log("\n[4/8] Deploying AuditLog...");
  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy(deployer.address);
  await auditLog.waitForDeployment();
  const auditLogAddress = await auditLog.getAddress();
  console.log("✔ AuditLog deployed to:", auditLogAddress);

  // 5. Deploy RecordRegistry
  console.log("\n[5/8] Deploying RecordRegistry...");
  const RecordRegistry = await ethers.getContractFactory("RecordRegistry");
  const recordRegistry = await RecordRegistry.deploy(
    deployer.address,
    hospitalRegistryAddress,
    auditLogAddress
  );
  await recordRegistry.waitForDeployment();
  const recordRegistryAddress = await recordRegistry.getAddress();
  console.log("✔ RecordRegistry deployed to:", recordRegistryAddress);

  // 6. Deploy ConsentManager
  console.log("\n[6/8] Deploying ConsentManager...");
  const ConsentManager = await ethers.getContractFactory("ConsentManager");
  const consentManager = await ConsentManager.deploy(
    deployer.address,
    hospitalRegistryAddress,
    recordRegistryAddress,
    auditLogAddress
  );
  await consentManager.waitForDeployment();
  const consentManagerAddress = await consentManager.getAddress();
  console.log("✔ ConsentManager deployed to:", consentManagerAddress);

  // 7. Deploy ForeignRecordRef (Cross-chain ingested proofs)
  console.log("\n[7/8] Deploying ForeignRecordRef (Cross-Chain Storage)...");
  const ForeignRecordRef = await ethers.getContractFactory("ForeignRecordRef");
  const foreignRecordRef = await ForeignRecordRef.deploy(forwarderAddress, deployer.address);
  await foreignRecordRef.waitForDeployment();
  const foreignRecordRefAddress = await foreignRecordRef.getAddress();
  console.log("✔ ForeignRecordRef deployed to:", foreignRecordRefAddress);

  // 8. Deploy FederationRegistry (Neutral Cross-Chain Consortium Root)
  console.log("\n[8/8] Deploying FederationRegistry (Consortium Trust Directory)...");
  const FederationRegistry = await ethers.getContractFactory("FederationRegistry");
  const federationRegistry = await FederationRegistry.deploy(deployer.address);
  await federationRegistry.waitForDeployment();
  const federationRegistryAddress = await federationRegistry.getAddress();
  console.log("✔ FederationRegistry deployed to:", federationRegistryAddress);

  // 9. Configure Role Permissions
  console.log("\nConfiguring Contract Roles...");
  const RECORDER_ROLE = await auditLog.RECORDER_ROLE();
  let tx = await auditLog.grantRole(RECORDER_ROLE, recordRegistryAddress);
  await tx.wait();
  tx = await auditLog.grantRole(RECORDER_ROLE, consentManagerAddress);
  await tx.wait();
  console.log("✔ AuditLog roles configured.");

  const deploymentData = {
    network: "sepolia",
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      MinimalForwarder: forwarderAddress,
      StaffRegistry: staffRegistryAddress,
      HospitalRegistry: hospitalRegistryAddress,
      AuditLog: auditLogAddress,
      RecordRegistry: recordRegistryAddress,
      ConsentManager: consentManagerAddress,
      ForeignRecordRef: foreignRecordRefAddress,
      FederationRegistry: federationRegistryAddress,
    },
  };

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, "sepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n✔ Sepolia deployment saved to: ${outPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
