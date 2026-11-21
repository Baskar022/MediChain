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

  // Gas overrides tailored for Polygon Amoy to fit within deployer balance
  const maxPriorityFeePerGas = ethers.parseUnits("30", "gwei");
  const maxFeePerGas = ethers.parseUnits("38", "gwei");
  const txOverrides = { maxFeePerGas, maxPriorityFeePerGas, gasLimit: 1300000 };

  console.log(`Gas overrides: PriorityFee=30 Gwei, MaxFee=38 Gwei, GasLimit=1300000`);

  // Reuse already deployed MinimalForwarder & StaffRegistry if valid
  let forwarderAddress = "0xc5D5c5dDf16136Aa25998A2AD2407191c8746F27";
  let staffRegistryAddress = "0x58D0cb219E268391cA783ABF27a894a0A146Dd27";

  console.log("\n[1/7] MinimalForwarder (ERC-2771):", forwarderAddress);
  console.log("[2/7] StaffRegistry (Hospital 2 Staff Roles):", staffRegistryAddress);

  // 3. Deploy HospitalRegistry
  console.log("\n[3/7] Deploying HospitalRegistry...");
  const HospitalRegistry = await ethers.getContractFactory("HospitalRegistry");
  const hospitalRegistry = await HospitalRegistry.deploy(deployer.address, txOverrides);
  await hospitalRegistry.waitForDeployment();
  const hospitalRegistryAddress = await hospitalRegistry.getAddress();
  console.log("✔ HospitalRegistry deployed to:", hospitalRegistryAddress);

  // 4. Deploy AuditLog
  console.log("\n[4/7] Deploying AuditLog...");
  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy(deployer.address, txOverrides);
  await auditLog.waitForDeployment();
  const auditLogAddress = await auditLog.getAddress();
  console.log("✔ AuditLog deployed to:", auditLogAddress);

  // 5. Deploy RecordRegistry
  console.log("\n[5/7] Deploying RecordRegistry...");
  const RecordRegistry = await ethers.getContractFactory("RecordRegistry");
  const recordRegistry = await RecordRegistry.deploy(
    deployer.address,
    hospitalRegistryAddress,
    auditLogAddress,
    { ...txOverrides, gasLimit: 1800000 }
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
    auditLogAddress,
    { ...txOverrides, gasLimit: 2200000 }
  );
  await consentManager.waitForDeployment();
  const consentManagerAddress = await consentManager.getAddress();
  console.log("✔ ConsentManager deployed to:", consentManagerAddress);

  // 7. Deploy ForeignRecordRef (Cross-chain ingested proofs)
  console.log("\n[7/7] Deploying ForeignRecordRef (Cross-Chain Storage)...");
  const ForeignRecordRef = await ethers.getContractFactory("ForeignRecordRef");
  const foreignRecordRef = await ForeignRecordRef.deploy(forwarderAddress, deployer.address, txOverrides);
  await foreignRecordRef.waitForDeployment();
  const foreignRecordRefAddress = await foreignRecordRef.getAddress();
  console.log("✔ ForeignRecordRef deployed to:", foreignRecordRefAddress);

  // 8. Configure Role Permissions
  console.log("\nConfiguring Contract Roles...");
  const RECORDER_ROLE = await auditLog.RECORDER_ROLE();
  let tx = await auditLog.grantRole(RECORDER_ROLE, recordRegistryAddress, txOverrides);
  await tx.wait();
  tx = await auditLog.grantRole(RECORDER_ROLE, consentManagerAddress, txOverrides);
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
