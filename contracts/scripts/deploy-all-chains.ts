import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Standard compiled artifacts path
const artifactsDir = path.join(__dirname, "../artifacts/contracts");

function loadArtifact(contractName: string, subPath?: string) {
  const filePath = path.join(artifactsDir, subPath ? `${subPath}/${contractName}.sol` : `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact for ${contractName} not found at ${filePath}. Run 'npx hardhat compile' first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

const DEFAULT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function deployHospitalContracts(rpcUrl: string, chainName: string) {
  console.log(`\n======================================================`);
  console.log(` Deploying Sovereign Contracts to ${chainName} (${rpcUrl})`);
  console.log(`======================================================`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    const net = await provider.getNetwork();
    console.log(` Connected to ${chainName}: Chain ID ${net.chainId}`);
  } catch (err: any) {
    console.warn(` [SKIP] ${chainName} at ${rpcUrl} is not running: ${err.message}`);
    return null;
  }

  const wallet = new ethers.Wallet(DEFAULT_PRIVATE_KEY, provider);

  const hospitalRegistryArt = loadArtifact("HospitalRegistry");
  const auditLogArt = loadArtifact("AuditLog");
  const recordRegistryArt = loadArtifact("RecordRegistry");
  const consentManagerArt = loadArtifact("ConsentManager");

  const HospitalRegistryFactory = new ethers.ContractFactory(hospitalRegistryArt.abi, hospitalRegistryArt.bytecode, wallet);
  const AuditLogFactory = new ethers.ContractFactory(auditLogArt.abi, auditLogArt.bytecode, wallet);
  const RecordRegistryFactory = new ethers.ContractFactory(recordRegistryArt.abi, recordRegistryArt.bytecode, wallet);
  const ConsentManagerFactory = new ethers.ContractFactory(consentManagerArt.abi, consentManagerArt.bytecode, wallet);

  // 1. HospitalRegistry
  console.log(`  [1/4] Deploying HospitalRegistry on ${chainName}...`);
  const hospitalRegistry = await (await HospitalRegistryFactory.deploy(wallet.address)).waitForDeployment();
  const hospitalRegistryAddress = await hospitalRegistry.getAddress();

  // 2. AuditLog
  console.log(`  [2/4] Deploying AuditLog on ${chainName}...`);
  const auditLog = await (await AuditLogFactory.deploy(wallet.address)).waitForDeployment();
  const auditLogAddress = await auditLog.getAddress();

  // 3. RecordRegistry
  console.log(`  [3/4] Deploying RecordRegistry on ${chainName}...`);
  const recordRegistry = await (await RecordRegistryFactory.deploy(wallet.address, hospitalRegistryAddress, auditLogAddress)).waitForDeployment();
  const recordRegistryAddress = await recordRegistry.getAddress();

  // 4. ConsentManager
  console.log(`  [4/4] Deploying ConsentManager on ${chainName}...`);
  const consentManager = await (await ConsentManagerFactory.deploy(wallet.address, hospitalRegistryAddress, recordRegistryAddress, auditLogAddress)).waitForDeployment();
  const consentManagerAddress = await consentManager.getAddress();

  // Grant RECORDER_ROLE on AuditLog
  const RECORDER_ROLE = await (auditLog as any).RECORDER_ROLE();
  await (await (auditLog as any).grantRole(RECORDER_ROLE, recordRegistryAddress)).wait();
  await (await (auditLog as any).grantRole(RECORDER_ROLE, consentManagerAddress)).wait();
  console.log(`  [✔] Configured roles on ${chainName}`);

  return {
    HospitalRegistry: hospitalRegistryAddress,
    AuditLog: auditLogAddress,
    RecordRegistry: recordRegistryAddress,
    ConsentManager: consentManagerAddress,
  };
}

async function deployFederationRegistry(rpcUrl: string) {
  console.log(`\n======================================================`);
  console.log(` Deploying Federation Registry Contract (${rpcUrl})`);
  console.log(`======================================================`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    const net = await provider.getNetwork();
    console.log(` Connected to Federation Chain: Chain ID ${net.chainId}`);
  } catch (err: any) {
    console.warn(` [SKIP] Federation Chain at ${rpcUrl} is not running: ${err.message}`);
    return null;
  }

  const wallet = new ethers.Wallet(DEFAULT_PRIVATE_KEY, provider);
  const federationArt = loadArtifact("FederationRegistry");
  const FederationFactory = new ethers.ContractFactory(federationArt.abi, federationArt.bytecode, wallet);

  const federationContract = await (await FederationFactory.deploy(wallet.address)).waitForDeployment();
  const federationAddress = await federationContract.getAddress();
  console.log(`  [✔] FederationRegistry deployed to: ${federationAddress}`);

  return { FederationRegistry: federationAddress };
}

async function main() {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
  };

  result.networkA = await deployHospitalContracts("http://127.0.0.1:8545", "Network A (City General Hospital)");
  result.networkB = await deployHospitalContracts("http://127.0.0.1:8546", "Network B (Regional Specialty Hospital)");
  result.federation = await deployFederationRegistry("http://127.0.0.1:8547");

  const outPathContracts = path.join(__dirname, "../deployed-chains.json");
  const outPathWeb = path.join(__dirname, "../../web/src/lib/contracts/deployed-chains.json");

  fs.writeFileSync(outPathContracts, JSON.stringify(result, null, 2));
  fs.writeFileSync(outPathWeb, JSON.stringify(result, null, 2));

  console.log("\n======================================================");
  console.log(" Multi-Chain Deployment Script Summary Saved to:");
  console.log(`  1. ${outPathContracts}`);
  console.log(`  2. ${outPathWeb}`);
  console.log("======================================================\n");
}

main().catch((err) => {
  console.error("Multi-chain deployment error:", err);
  process.exit(1);
});
