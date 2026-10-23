import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=================================================");
  console.log(" MediChain Deployment to Network");
  console.log(" Deployer Account:", deployer.address);
  console.log("=================================================");

  // 1. Deploy HospitalRegistry
  console.log("\n[1/4] Deploying HospitalRegistry...");
  const HospitalRegistry = await ethers.getContractFactory("HospitalRegistry");
  const hospitalRegistry = await HospitalRegistry.deploy(deployer.address);
  await hospitalRegistry.waitForDeployment();
  const hospitalRegistryAddress = await hospitalRegistry.getAddress();
  console.log("✔ HospitalRegistry deployed to:", hospitalRegistryAddress);

  // 2. Deploy AuditLog
  console.log("\n[2/4] Deploying AuditLog...");
  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy(deployer.address);
  await auditLog.waitForDeployment();
  const auditLogAddress = await auditLog.getAddress();
  console.log("✔ AuditLog deployed to:", auditLogAddress);

  // 3. Deploy RecordRegistry
  console.log("\n[3/4] Deploying RecordRegistry...");
  const RecordRegistry = await ethers.getContractFactory("RecordRegistry");
  const recordRegistry = await RecordRegistry.deploy(
    deployer.address,
    hospitalRegistryAddress,
    auditLogAddress
  );
  await recordRegistry.waitForDeployment();
  const recordRegistryAddress = await recordRegistry.getAddress();
  console.log("✔ RecordRegistry deployed to:", recordRegistryAddress);

  // 4. Deploy ConsentManager
  console.log("\n[4/4] Deploying ConsentManager...");
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

  // 5. Authorize RecordRegistry and ConsentManager on AuditLog
  console.log("\n[5/5] Configuring Access Roles...");
  const RECORDER_ROLE = await auditLog.RECORDER_ROLE();
  let tx = await auditLog.grantRole(RECORDER_ROLE, recordRegistryAddress);
  await tx.wait();
  tx = await auditLog.grantRole(RECORDER_ROLE, consentManagerAddress);
  await tx.wait();
  console.log("✔ AuditLog RECORDER_ROLE granted to RecordRegistry and ConsentManager");

  console.log("\n=================================================");
  console.log(" Deployment Completed Successfully!");
  console.log(" Contract Addresses Summary:");
  console.log(
    JSON.stringify(
      {
        HospitalRegistry: hospitalRegistryAddress,
        AuditLog: auditLogAddress,
        RecordRegistry: recordRegistryAddress,
        ConsentManager: consentManagerAddress,
      },
      null,
      2
    )
  );
  console.log("=================================================");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
