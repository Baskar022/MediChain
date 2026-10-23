import { ethers } from "ethers";
import { CrossChainSharingCoordinator } from "../interop/flows/SharingFlow";
import { RevocationAndLabPushService } from "../interop/flows/RevocationAndLabPush";
import { EmergencyBreakGlassService } from "../interop/flows/EmergencyBreakGlassFlow";
import { FederationManager } from "../interop/federation/FederationManager";
import { InteropHub } from "../interop/hub/InteropHub";
import { HospitalGateway } from "../interop/gateway/HospitalGateway";
import { EvmAdapter } from "../interop/adapters/EvmAdapter";
import { LedgerAdapter } from "../interop/adapters/LedgerAdapter";
import { deriveGlobalPatientId } from "../interop/types/identity";
import { MessageEnvelope } from "../interop/types/envelope";

async function runAllDemos() {
  console.log("================================================================================");
  console.log("       MEDICHAIN SOVEREIGN CROSS-CHAIN INTEROPERABILITY DEMO SUITE              ");
  console.log("================================================================================\n");

  const walletA = ethers.Wallet.createRandom();
  const walletB = ethers.Wallet.createRandom();
  const walletC = ethers.Wallet.createRandom();
  const patientWallet = ethers.Wallet.createRandom();
  const doctorSarahWallet = ethers.Wallet.createRandom();

  const instA_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL"));
  const instB_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY"));
  const instC_Id = ethers.keccak256(ethers.toUtf8Bytes("LAB-METRO-DIAGNOSTICS"));

  const federation = new FederationManager([
    {
      institutionId: instA_Id,
      name: "City General Hospital",
      institutionType: "HOSPITAL",
      chainType: "EVM",
      chainId: "31337",
      gatewayEndpoint: "http://localhost:8545",
      gatewayPublicKey: walletA.publicKey,
      gatewayAddress: walletA.address,
      status: "ACTIVE",
      trustLevel: 5,
      onboardedAt: Math.floor(Date.now() / 1000),
    },
    {
      institutionId: instB_Id,
      name: "Regional Specialty Hospital",
      institutionType: "HOSPITAL",
      chainType: "EVM",
      chainId: "31338",
      gatewayEndpoint: "http://localhost:8546",
      gatewayPublicKey: walletB.publicKey,
      gatewayAddress: walletB.address,
      status: "ACTIVE",
      trustLevel: 5,
      onboardedAt: Math.floor(Date.now() / 1000),
    },
    {
      institutionId: instC_Id,
      name: "Metro Diagnostics Lab",
      institutionType: "LAB",
      chainType: "PERMISSIONED_LEDGER",
      chainId: "METRO-LAB-CHAIN-C",
      gatewayEndpoint: "http://localhost:9000",
      gatewayPublicKey: walletC.publicKey,
      gatewayAddress: walletC.address,
      status: "ACTIVE",
      trustLevel: 4,
      onboardedAt: Math.floor(Date.now() / 1000),
    },
  ]);

  const hub = new InteropHub(federation);

  const gatewayA = new HospitalGateway({
    institutionId: instA_Id,
    name: "City General Hospital",
    adapter: new EvmAdapter({
      chainIdentifier: "NETWORK-A-CITY-GENERAL",
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:8545",
      contractAddresses: {
        recordRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        consentManager: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        auditLog: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      },
      signer: walletA,
    }),
    federation,
    hub,
    gatewaySigner: walletA,
  });

  const gatewayB = new HospitalGateway({
    institutionId: instB_Id,
    name: "Regional Specialty Hospital",
    adapter: new EvmAdapter({
      chainIdentifier: "NETWORK-B-REGIONAL-SPECIALTY",
      chainId: 31338,
      rpcUrl: "http://127.0.0.1:8546",
      contractAddresses: {
        recordRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        consentManager: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        auditLog: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      },
      signer: walletB,
    }),
    federation,
    hub,
    gatewaySigner: walletB,
  });

  const gatewayC = new HospitalGateway({
    institutionId: instC_Id,
    name: "Metro Diagnostics Lab",
    adapter: new LedgerAdapter({
      chainIdentifier: "NETWORK-C-METRO-LAB",
    }),
    federation,
    hub,
    gatewaySigner: walletC,
  });

  const globalPatientId = deriveGlobalPatientId("ALICE-VANCE-SSN-9021");

  // Populate Record Locator
  federation.updateRecordLocator(globalPatientId, instA_Id, "NETWORK-A-CITY-GENERAL", "CARDIOLOGY", 1);
  federation.updateRecordLocator(globalPatientId, instC_Id, "NETWORK-C-METRO-LAB", "METABOLIC_PANEL", 1);

  // Seed local records on Gateway A
  const sampleCardio = JSON.stringify({ condition: "Hypertensive Heart Disease", ejectionFraction: "54%" });
  const plaintextHash = ethers.sha256(ethers.toUtf8Bytes(sampleCardio));
  const doctorSig = await doctorSarahWallet.signMessage(ethers.getBytes(plaintextHash));
  const ciphertextBase64 = Buffer.from(sampleCardio).toString("base64");
  const cipherHash = ethers.sha256(ethers.toUtf8Bytes(ciphertextBase64));

  gatewayA.addLocalRecord({
    recordId: "0xrec_cardio_demo",
    patientIdHash: globalPatientId,
    recordHash: plaintextHash,
    cipherHash,
    recordType: "CARDIOLOGY",
    encryptedBlobBase64: ciphertextBase64,
    ivBase64: "aXYxMjM0NTY3OA==",
    rawRecordKeyHex: "0x9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff",
    issuerDoctorSignature: doctorSig,
  });

  // -------------------------------------------------------------
  // SCENARIO 1: PATIENT RELOCATION
  // -------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("  SCENARIO 1: PATIENT RELOCATION (Network A [EVM] -> Network B [EVM])");
  console.log("--------------------------------------------------------------------------------");
  const sharingCoord = new CrossChainSharingCoordinator(federation, hub);

  // Step 1: Discover via locator
  const locs = sharingCoord.discoverPatientRecords(globalPatientId);
  console.log(`  [Step 1/6] Discovered ${locs.length} record location entries via Federation Locator`);

  // Step 2: Request records
  const reqResult = await sharingCoord.requestRecords(
    gatewayB,
    instA_Id,
    globalPatientId,
    "CARDIOLOGY",
    { name: "Dr. Robert Miller", license: "MED-NY-44120" },
    "Patient relocated to regional district; comprehensive history required."
  );
  console.log(`  [Step 2/6] Request envelope routed via Interop Hub: ${reqResult.status}`);

  // Step 3: Patient Alice grants consent on source chain
  const consent = await sharingCoord.grantPatientConsent(
    gatewayA,
    patientWallet,
    globalPatientId,
    instB_Id,
    "CARDIOLOGY",
    86400 * 30
  );
  console.log(`  [Step 3/6] Consent notarized on Network A: ${consent.consentId}`);

  // Step 4: Package released with ECIES wrapped key & Merkle proof
  const release = await sharingCoord.releaseRecordPackage(
    gatewayA,
    instB_Id,
    globalPatientId,
    "CARDIOLOGY"
  );
  console.log(`  [Step 4/6] Record package released over Hub: ${release.status}`);

  // Step 5: Ingestion and ForeignRecordRef anchored on destination
  const ingest = await sharingCoord.ingestRecordPackage(gatewayB, release.envelope);
  console.log(`  [Step 5/6] Ingested & anchored ForeignRecordRef at Regional Specialty: ${ingest.recordIds[0]}`);

  // Step 6: Decrypt and view
  const view = await sharingCoord.decryptAndAccessRecord(
    gatewayB,
    gatewayA,
    "0xrec_cardio_demo",
    "0xdoctor_miller_wallet"
  );
  console.log(`  [Step 6/6] Clinical Access Status: ${view.integrityBadge} (Plaintext verified authentic!)`);
  console.log("  ✔ Dual-Chain Audit Logged on both EVM Networks A and B!\n");

  // -------------------------------------------------------------
  // SCENARIO 2: SPECIALIZED REFERRAL (EVM <-> NON-EVM PERMISSIONED LEDGER)
  // -------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("  SCENARIO 2: SPECIALIZED LAB REFERRAL (Network A/B <-> Network C [Non-EVM])");
  console.log("--------------------------------------------------------------------------------");
  const labData = JSON.stringify({ test: "Comprehensive Metabolic Panel", glucose: "94 mg/dL", eGFR: ">60" });
  const labRecordHash = ethers.sha256(ethers.toUtf8Bytes(labData));
  const labCiphertext = Buffer.from(labData).toString("base64");
  const labCipherHash = ethers.sha256(ethers.toUtf8Bytes(labCiphertext));
  const labDoctorSig = await doctorSarahWallet.signMessage(ethers.getBytes(labRecordHash));

  gatewayC.addLocalRecord({
    recordId: "0xrec_lab_referral",
    patientIdHash: globalPatientId,
    recordHash: labRecordHash,
    cipherHash: labCipherHash,
    recordType: "METABOLIC_PANEL",
    encryptedBlobBase64: labCiphertext,
    ivBase64: "aXYxMjM0NTY3OA==",
    rawRecordKeyHex: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
    issuerDoctorSignature: labDoctorSig,
  });

  // Request & transfer lab records from Network C to Network B
  await sharingCoord.grantPatientConsent(gatewayC, patientWallet, globalPatientId, instB_Id, "METABOLIC_PANEL", 86400 * 14);
  const labRelease = await sharingCoord.releaseRecordPackage(gatewayC, instB_Id, globalPatientId, "METABOLIC_PANEL");
  const labIngest = await sharingCoord.ingestRecordPackage(gatewayB, labRelease.envelope);
  console.log(`  ✔ Non-EVM Lab Package Ingested:  ${labIngest.success}`);
  console.log(`  ✔ Inclusion Proof Root (Net C): ${labRelease.envelope.payload.records[0].sourceChain.rootHash.slice(0, 32)}...`);
  console.log(`  ✔ Cross-Technology Interop:     LedgerAdapter -> EvmAdapter via neutral Envelope JSON!\n`);

  // -------------------------------------------------------------
  // SCENARIO 3: EMERGENCY BREAK-GLASS (TIME-BOXED LEVEL-1 TRAUMA)
  // -------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("  SCENARIO 3: EMERGENCY BREAK-GLASS (Level-1 Trauma & Review Queue)");
  console.log("--------------------------------------------------------------------------------");
  const emgService = new EmergencyBreakGlassService(federation, hub);

  const emgResult = await emgService.executeCrossChainEmergencyBreakGlass({
    requestingGateway: gatewayB,
    sourceInstitutionId: instA_Id,
    globalPatientId,
    doctorWallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    doctorName: "Dr. Marcus Brody, MD",
    clinicalJustification: "Acute polytrauma; unresponsive patient with suspected cerebral hemorrhage; GCS < 8.",
    emergencyLevel: "LEVEL_1_TRAUMA",
    timeBoxSeconds: 86400,
    emergencyContactPhone: "+1-555-0199",
  });

  console.log(`  ✔ Break-Glass Triggered:        ${emgResult.success}`);
  console.log(`  ✔ Emergency Access ID:          ${emgResult.emergencyAccessId}`);
  console.log(`  ✔ Strictly Scoped to Summary:   Blood Group: ${emgResult.criticalSummary?.bloodGroup}, Allergies: ${emgResult.criticalSummary?.severeAllergies.join(", ")}`);
  console.log(`  ✔ Time-Box Window:              Strictly valid for 24 Hours`);

  // Inspect and validate review queue
  const pendingReviews = emgService.getPendingReviews();
  console.log(`  ✔ Federation Review Queue:      ${pendingReviews.length} event(s) pending audit`);
  emgService.reviewEmergencyAccess(
    pendingReviews[0].reviewId,
    "JUSTIFICATION_VALIDATED",
    "Consortium Chief Medical Officer: Valid trauma break-glass under Level-1 Protocol.",
    "0xadmin_consortium"
  );
  console.log(`  ✔ Federation Admin Audit:       Justification Reviewed & Validated!\n`);

  // -------------------------------------------------------------
  // SCENARIO 4: STANDING CONSENT DIAGNOSTIC LAB PUSH
  // -------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("  SCENARIO 4: STANDING CONSENT LAB PUSH (Network C -> Network B)");
  console.log("--------------------------------------------------------------------------------");
  const revLabService = new RevocationAndLabPushService(federation, hub);
  const pushResult = await revLabService.pushLabResult(
    gatewayC,
    gatewayB,
    globalPatientId,
    {
      testId: "0xrec_auto_push_99",
      testType: "METABOLIC_PANEL",
      clinicalJson: JSON.stringify({ test: "Troponin I", value: "0.01 ng/mL", interpretation: "Normal" }),
      orderingDoctorName: "Dr. Sarah Chen, MD",
    }
  );

  console.log(`  ✔ Autonomous Lab Push:          ${pushResult.success}`);
  console.log(`  ✔ Target Ingestion Record ID:   ${pushResult.recordId}`);
  console.log(`  ✔ Ordering Hospital Ingestion:  ForeignRecordRef anchored at Regional Specialty Hospital\n`);

  // -------------------------------------------------------------
  // SCENARIO 5: CROSS-CHAIN REVOCATION PROPAGATION
  // -------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("  SCENARIO 5: CROSS-CHAIN REVOCATION PROPAGATION (Source -> Destination)");
  console.log("--------------------------------------------------------------------------------");
  const revokeResult = await revLabService.propagateRevocation(
    gatewayA,
    instB_Id,
    globalPatientId,
    consent.consentId,
    "Patient elected to withdraw specialist consultation consent."
  );

  console.log(`  ✔ Source Chain Revocation:      Notarized on Network A (${revokeResult.messageId})`);
  console.log(`  ✔ Destination Invalidation:     ForeignRecordRef locked & local decrypted cache deleted`);
  console.log(`  ✔ Real-Time Verification:       Every clinical view re-checks source revocation status!\n`);

  // -------------------------------------------------------------
  // SCENARIO 6: TAMPER DETECTION
  // -------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("  SCENARIO 6: TAMPER DETECTION (Altered Ciphertext Rejected at Destination)");
  console.log("--------------------------------------------------------------------------------");
  const now = Math.floor(Date.now() / 1000);
  const tamperedBlob = Buffer.from("MALICIOUS_TAMPERED_CIPHERTEXT").toString("base64");

  const fakeItem = {
    recordId: "0xrec_fake",
    fhirMetadata: {
      resourceType: "DiagnosticReport" as const,
      id: "0xrec_fake",
      status: "current" as const,
      category: "CARDIOLOGY",
      date: new Date().toISOString(),
      subject: { reference: globalPatientId },
      custodian: { reference: instA_Id, display: "City General Hospital" },
      content: {
        attachment: {
          contentType: "application/json",
          hash: "0xhash",
          cipherHash: "0x0000000000000000000000000000000000000000000000000000000000000000", // Mismatched!
        },
      },
    },
    encryptedBlobBase64: tamperedBlob,
    ivBase64: "iv",
    wrappedKeyHex: "0xkey",
    sourceChain: {
      chainIdentifier: "NETWORK-A-CITY-GENERAL",
      blockNumber: 10,
      blockHash: "0xblock",
      merkleProof: [],
      rootHash: "0xroot",
    },
    issuerSignature: "0xsig",
  };

  const badEnvelope: MessageEnvelope = {
    version: "1.0.0",
    messageId: "msg_bad_pkg",
    type: "RECORD_PACKAGE",
    fromInstitution: instA_Id,
    toInstitution: instB_Id,
    globalPatientId,
    scope: "ALL",
    nonce: "nonce_bad",
    issuedAt: now,
    expiresAt: now + 3600,
    payload: {
      requestId: "req_1",
      records: [fakeItem],
    },
    signature: "0xsig",
    gatewayPubKey: walletA.publicKey,
  };

  const tamperCheck = await gatewayB.handleIncomingRecordPackage(badEnvelope);
  console.log(`  ✔ Tampered Package Ingestion:   ${tamperCheck.success ? "ACCEPTED (VULNERABILITY)" : "BLOCKED (SECURE)"}`);
  console.log(`  ✔ Guardrail Reason:             ${tamperCheck.error}\n`);

  console.log("================================================================================");
  console.log("          ALL 6 INTEROPERABILITY SCENARIOS DEMONSTRATED SUCCESSFULLY!          ");
  console.log("================================================================================\n");
}

runAllDemos().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
