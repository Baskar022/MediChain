import algosdk from "algosdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { normalizeAlgorandMnemonic } from "./algo-tool";

dotenv.config();

async function main() {
  const algodUrl = process.env.ALGORAND_ALGOD_URL || "https://testnet-api.algonode.cloud";
  const algodPort = 443;
  const algodToken = process.env.ALGORAND_ALGOD_TOKEN || "";
  const algodClient = new algosdk.Algodv2(algodToken, algodUrl, algodPort);

  console.log("=================================================");
  console.log(" MediChain Sovereign Network C Deployment (Algorand AVM)");
  console.log(" Network: Algorand TestNet");
  console.log(" Node Endpoint:", algodUrl);
  console.log("=================================================");

  const mnemonic = process.env.ALGORAND_DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    console.error("❌ ERROR: ALGORAND_DEPLOYER_MNEMONIC is not defined in .env");
    console.log("Please create an Algorand TestNet account or run 'npm run algo:new'");
    process.exit(1);
  }

  const normalized = normalizeAlgorandMnemonic(mnemonic);
  const account = algosdk.mnemonicToSecretKey(normalized.fullMnemonic);
  console.log("Deployer Algorand Address:", account.addr.toString());

  // Check account balance
  const accountInfo = await algodClient.accountInformation(account.addr.toString()).do();
  const balanceMicroAlgos = Number(accountInfo.amount || 0);
  const balanceAlgos = balanceMicroAlgos / 1e6;
  console.log("Account Balance:", balanceAlgos, "ALGO");

  if (balanceAlgos < 0.5) {
    console.warn("⚠ WARNING: Account balance is low (< 0.5 ALGO). Please request testnet funds at https://bank.testnet.algorand.network/");
  }

  // 1. Read TEAL contracts
  const approvalPath = path.join(__dirname, "../contracts/algorand/DiagnosticLabApp.teal");
  const clearPath = path.join(__dirname, "../contracts/algorand/ClearState.teal");

  if (!fs.existsSync(approvalPath) || !fs.existsSync(clearPath)) {
    console.error("❌ ERROR: TEAL contract files not found at:", approvalPath);
    process.exit(1);
  }

  const approvalSource = fs.readFileSync(approvalPath, "utf8");
  const clearSource = fs.readFileSync(clearPath, "utf8");

  // 2. Compile TEAL programs
  console.log("\n[1/3] Compiling Approval TEAL Program...");
  const compiledApproval = await algodClient.compile(Buffer.from(approvalSource)).do();
  console.log("✔ Approval Program Hash:", compiledApproval.hash);

  console.log("\n[2/3] Compiling Clear State TEAL Program...");
  const compiledClear = await algodClient.compile(Buffer.from(clearSource)).do();
  console.log("✔ Clear Program Hash:", compiledClear.hash);

  const approvalBytes = new Uint8Array(Buffer.from(compiledApproval.result, "base64"));
  const clearBytes = new Uint8Array(Buffer.from(compiledClear.result, "base64"));

  // 3. Create Application Transaction
  console.log("\n[3/3] Submitting Application Create Transaction to Algorand TestNet...");
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: account.addr.toString(),
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approvalBytes,
    clearProgram: clearBytes,
    numLocalInts: 0,
    numLocalByteSlices: 0,
    numGlobalInts: 8,
    numGlobalByteSlices: 8,
    extraPages: 0,
  });

  const signedTxn = txn.signTxn(account.sk);
  const { txid } = await algodClient.sendRawTransaction(signedTxn).do();
  console.log("Submitted TX ID:", txid);
  console.log("Waiting for confirmation on Algorand TestNet...");

  const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txid, 5);
  const appId = Number(confirmedTxn.applicationIndex || confirmedTxn["application-index"]);

  console.log("\n=================================================");
  console.log("🎉 SUCCESS: Algorand Diagnostic Lab App Deployed!");
  console.log("App ID:", appId);
  console.log("Confirmed Round:", confirmedTxn.confirmedRound || confirmedTxn["confirmed-round"]);
  console.log("AlgoExplorer / Pera Explorer Link:");
  console.log(`https://testnet.explorer.perawallet.app/application/${appId}/`);
  console.log("=================================================");

  const deploymentData = {
    network: "algorand-testnet",
    appId,
    creatorAddress: account.addr.toString(),
    deployedAt: new Date().toISOString(),
    txId: txid,
    approvalHash: compiledApproval.hash,
    clearHash: compiledClear.hash,
  };

  const outDir = path.join(__dirname, "../contracts/deployments");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, "algorand.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n✔ Saved deployment artifact to: ${outPath}`);
}

main().catch((err) => {
  console.error("Algorand deployment failed:", err);
  process.exit(1);
});
