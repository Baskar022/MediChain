import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();

  console.log("=================================================");
  console.log(" MediChain Sovereign Network B Deployment");
  console.log(" Target Network: Polygon Amoy (Chain ID:", network.chainId.toString() + ")");
  console.log(" Deployer Account:", deployer.address);
  console.log(" Deployer Balance:", ethers.formatEther(balance), "POL");
  console.log("=================================================");

  if (balance === 0n) {
    console.warn("⚠ WARNING: Deployer balance is 0 POL. Deployment will fail without Polygon Amoy faucet funds.");
  }

  // 1. Deploy MinimalForwarder (ERC-2771 Gasless Meta-Transactions)
  console.log("\n[1/7] Deploying MinimalForwarder (ERC-2771)...");
  const Forwarder = await ethers.getContractFactory("MinimalForwarder");
  const forwarder = await Forwarder.deploy();
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  console.log("✔ MinimalForwarder deployed to:", forwarderAddress);

  // 2. Deploy StaffRegistry (Hospital 2 Staff Roles)
  console.log("\n[2/7] Deploying StaffRegistry (Hospital 2 Staff Roles)...");
  const StaffRegistry = await ethers.getContractFactory("StaffRegistry");
  const staffRegistry = await StaffRegistry.deploy(forwarderAddress, deployer.address);
  await staffRegistry.waitForDeployment();
  const staffRegistryAddress = await staffRegistry.getAddress();
  console.log("✔ StaffRegistry deployed to:", staffRegistryAddress);

  // 3. Deploy HospitalRegistry
  console.log("\n[3/7] Deploying HospitalRegistry...");
  const HospitalRegistry = await ethers.getContractFactory("HospitalRegistry");
  const hospitalRegistry = await HospitalRegistry.deploy(deployer.address);
  await hospitalRegistry.waitForDeployment();
  const hospitalRegistryAddress = await hospitalRegistry.getAddress();
  console.log("✔ HospitalRegistry deployed to:", hospitalRegistryAddress);

  // 4. Deploy AuditLog
  console.log("\n[4/7] Deploying AuditLog...");
  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy(deployer.address);
  await auditLog.waitForDeployment();
  const auditLogAddress = await auditLog.getAddress();
  console.log("✔ AuditLog deployed to:", auditLogAddress);

  // 5. Deploy RecordRegistry
  console.log("\n[5/7] Deploying RecordRegistry...");
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
  console.log("\n[6/7] Deploying ConsentManager...");
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
  console.log("\n[7/7] Deploying ForeignRecordRef (Cross-Chain Storage)...");
  const ForeignRecordRef = await ethers.getContractFactory("ForeignRecordRef");
  const foreignRecordRef = await ForeignRecordRef.deploy(forwarderAddress, deployer.address);
  await foreignRecordRef.waitForDeployment();
  const foreignRecordRefAddress = await foreignRecordRef.getAddress();
  console.log("✔ ForeignRecordRef deployed to:", foreignRecordRefAddress);

  // 8. Configure Role Permissions
  console.log("\nConfiguring Contract Roles...");
  const RECORDER_ROLE = await auditLog.RECORDER_ROLE();
  let tx = await auditLog.grantRole(RECORDER_ROLE, recordRegistryAddress);
  await tx.wait();
  tx = await auditLog.grantRole(RECORDER_ROLE, consentManagerAddress);
  await tx.wait();
  console.log("✔ AuditLog roles configured.");

  const deploymentData = {
    network: "amoy",
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
    },
  };

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, "amoy.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n✔ Polygon Amoy deployment saved to: ${outPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
