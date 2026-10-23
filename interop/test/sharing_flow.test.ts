import { expect } from "chai";
import { ethers } from "ethers";
import { FederationManager } from "../federation/FederationManager";
import { InteropHub } from "../hub/InteropHub";
import { HospitalGateway } from "../gateway/HospitalGateway";
import { EvmAdapter } from "../adapters/EvmAdapter";
import { LedgerAdapter } from "../adapters/LedgerAdapter";
import { CrossChainSharingCoordinator } from "../flows/SharingFlow";
import { deriveGlobalPatientId } from "../types/identity";

describe("Phase I-4: Cross-Chain Normal Sharing Flows (Relocation & Referral)", () => {
  let federation: FederationManager;
  let hub: InteropHub;
  let coordinator: CrossChainSharingCoordinator;

  let walletA: ethers.HDNodeWallet;
  let walletB: ethers.HDNodeWallet;
  let walletC: ethers.HDNodeWallet;
  let patientWallet: ethers.HDNodeWallet;
  let doctorSarahWallet: ethers.HDNodeWallet;

  let gatewayA: HospitalGateway; // City General (Network A - EVM)
  let gatewayB: HospitalGateway; // Regional Specialty (Network B - EVM)
  let gatewayC: HospitalGateway; // Metro Diagnostics Lab (Network C - Non-EVM)

  const instA_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL"));
  const instB_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY"));
  const instC_Id = ethers.keccak256(ethers.toUtf8Bytes("LAB-METRO-DIAGNOSTICS"));

  const globalPatientId = deriveGlobalPatientId("ALICE-VANCE-SSN-9021");

  beforeEach(async () => {
    walletA = ethers.Wallet.createRandom();
    walletB = ethers.Wallet.createRandom();
    walletC = ethers.Wallet.createRandom();
    patientWallet = ethers.Wallet.createRandom();
    doctorSarahWallet = ethers.Wallet.createRandom();

    federation = new FederationManager([
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

    hub = new InteropHub(federation);
    coordinator = new CrossChainSharingCoordinator(federation, hub);

    gatewayA = new HospitalGateway({
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

    gatewayB = new HospitalGateway({
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

    gatewayC = new HospitalGateway({
      institutionId: instC_Id,
      name: "Metro Diagnostics Lab",
      adapter: new LedgerAdapter({
        chainIdentifier: "NETWORK-C-METRO-LAB",
      }),
      federation,
      hub,
      gatewaySigner: walletC,
    });
  });

  describe("Scenario 1: PATIENT RELOCATION (City General EVM -> Regional Specialty EVM)", () => {
    const recordId = "0xrec_cardio_relocation_889";
    const clinicalJson = JSON.stringify({
      condition: "Hypertensive Heart Disease with Heart Failure",
      ejectionFraction: "54%",
      medications: ["Lisinopril 10mg daily", "Carvedilol 6.25mg BID"],
      lastVisitSummary: "Stable ambulatory presentation. Blood pressure controlled at 124/78 mmHg.",
    });

    beforeEach(async () => {
      // 1. Issuing doctor Sarah Chen signs the plaintext SHA-256 hash
      const plaintextHash = ethers.sha256(ethers.toUtf8Bytes(clinicalJson));
      const doctorSig = await doctorSarahWallet.signMessage(ethers.getBytes(plaintextHash));

      const ciphertextBase64 = Buffer.from(clinicalJson).toString("base64");
      const cipherHash = ethers.sha256(ethers.toUtf8Bytes(ciphertextBase64));

      // 2. City General anchors record on Network A
      gatewayA.addLocalRecord({
        recordId,
        patientIdHash: globalPatientId,
        recordHash: plaintextHash,
        cipherHash,
        recordType: "CARDIOLOGY",
        encryptedBlobBase64: ciphertextBase64,
        ivBase64: "aXYxMjM0NTY3OA==",
        rawRecordKeyHex: "0x9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff",
        issuerDoctorSignature: doctorSig,
      });
    });

    it("should execute full 6-step relocation flow with verification and dual audit log", async () => {
      // STEP 1: Discovery via Record Locator Index
      const locatorEntries = coordinator.discoverPatientRecords(globalPatientId);
      expect(locatorEntries.length).to.be.greaterThan(0);
      const entry = locatorEntries.find((e) => e.institutionId === instA_Id);
      expect(entry).to.exist;
      expect(entry!.recordType).to.equal("CARDIOLOGY");

      // STEP 2: Doctor at Regional Specialty requests history
      const req = await coordinator.requestRecords(
        gatewayB,
        instA_Id,
        globalPatientId,
        "CARDIOLOGY",
        { name: "Dr. Robert Miller", license: "MED-NY-44120" },
        "Patient relocated to regional district; comprehensive history required."
      );
      expect(req.status).to.equal("DELIVERED");

      // STEP 3: Patient Alice Vance grants consent on Source Chain (Network A)
      const consent = await coordinator.grantPatientConsent(
        gatewayA,
        patientWallet,
        globalPatientId,
        instB_Id,
        "CARDIOLOGY",
        86400 * 30 // 30 days
      );
      expect(consent.consentId).to.be.a("string");
      expect(consent.validUntil).to.be.greaterThan(Math.floor(Date.now() / 1000));

      // STEP 4: City General releases Record Package through Hub
      const release = await coordinator.releaseRecordPackage(
        gatewayA,
        instB_Id,
        globalPatientId,
        "CARDIOLOGY"
      );
      expect(release.status).to.equal("DELIVERED");
      expect(release.envelope.payload.records).to.have.lengthOf(1);

      // STEP 5: Regional Specialty ingests and anchors ForeignRecordRef
      const ingest = await coordinator.ingestRecordPackage(gatewayB, release.envelope);
      expect(ingest.success).to.be.true;
      expect(ingest.importedCount).to.equal(1);
      expect(ingest.recordIds[0]).to.equal(recordId);

      // Verify ForeignRecordRef existence on destination
      const foreignRef = gatewayB.getForeignRecord(recordId);
      expect(foreignRef).to.exist;
      expect(foreignRef!.sourceInstitutionId).to.equal(instA_Id);
      expect(foreignRef!.sourceChainId).to.equal("NETWORK-A-CITY-GENERAL");

      // STEP 6: Destination Doctor decrypts and views with live integrity badge
      const view = await coordinator.decryptAndAccessRecord(
        gatewayB,
        gatewayA,
        recordId,
        "0xdoctor_miller_wallet"
      );

      expect(view.integrityBadge).to.equal("VERIFIED_AUTHENTIC");
      expect(view.clinicalData.condition).to.equal("Hypertensive Heart Disease with Heart Failure");
      expect(view.clinicalData.ejectionFraction).to.equal("54%");
      expect(view.sourceInstitutionName).to.equal("City General Hospital");

      // Authenticity verification of issuing doctor signature
      expect(view.issuerDoctor.verifiedSignerAddress?.toLowerCase()).to.equal(
        doctorSarahWallet.address.toLowerCase()
      );
    });
  });

  describe("Scenario 2: SPECIALIZED REFERRAL (EVM <-> Non-EVM Permissioned Ledger)", () => {
    const labRecordId = "0xrec_lab_pathology_900";
    const labReportJson = JSON.stringify({
      test: "Comprehensive Metabolic & Lipid Panel",
      hba1c: "5.8%",
      cholesterolTotal: "178 mg/dL",
      hdl: "52 mg/dL",
      ldl: "98 mg/dL",
      interpretation: "Within normal limits; pre-diabetes risk low.",
    });

    beforeEach(async () => {
      // Author lab result on Network C (Metro Diagnostics Lab - Non-EVM)
      const plaintextHash = ethers.sha256(ethers.toUtf8Bytes(labReportJson));
      const labSignerSig = await walletC.signMessage(ethers.getBytes(plaintextHash));
      const ciphertextBase64 = Buffer.from(labReportJson).toString("base64");
      const cipherHash = ethers.sha256(ethers.toUtf8Bytes(ciphertextBase64));

      gatewayC.addLocalRecord({
        recordId: labRecordId,
        patientIdHash: globalPatientId,
        recordHash: plaintextHash,
        cipherHash,
        recordType: "METABOLIC_PANEL",
        encryptedBlobBase64: ciphertextBase64,
        ivBase64: "bGFiaXYxMjM0",
        rawRecordKeyHex: "0x1234123412341234123412341234123412341234123412341234123412341234",
        issuerDoctorSignature: labSignerSig,
      });
    });

    it("should seamlessly transfer non-EVM lab records to EVM Regional Specialty Hospital", async () => {
      // 1. Patient grants consent on Network C (LedgerAdapter)
      await coordinator.grantPatientConsent(
        gatewayC,
        patientWallet,
        globalPatientId,
        instB_Id,
        "METABOLIC_PANEL",
        86400 * 14
      );

      // 2. Lab Gateway releases Record Package with Non-EVM Merkle Inclusion Proof
      const release = await coordinator.releaseRecordPackage(
        gatewayC,
        instB_Id,
        globalPatientId,
        "METABOLIC_PANEL"
      );

      expect(release.status).to.equal("DELIVERED");
      const recordItem = release.envelope.payload.records[0];
      expect(recordItem.sourceChain.chainIdentifier).to.equal("NETWORK-C-METRO-LAB");
      expect(recordItem.sourceChain.merkleProof).to.be.an("array");

      // 3. EVM Gateway B ingests and validates the non-EVM proof
      const ingest = await coordinator.ingestRecordPackage(gatewayB, release.envelope);
      expect(ingest.success).to.be.true;

      // 4. Doctor views lab result
      const view = await coordinator.decryptAndAccessRecord(
        gatewayB,
        gatewayC,
        labRecordId,
        "0xdoctor_miller_wallet"
      );

      expect(view.integrityBadge).to.equal("VERIFIED_AUTHENTIC");
      expect(view.clinicalData.hba1c).to.equal("5.8%");
      expect(view.clinicalData.interpretation).to.include("Within normal limits");
    });
  });

  describe("Security Verification: Tamper Detection & Revocation Enforcement", () => {
    it("should reject tampered record package before anchoring", async () => {
      const corruptEnvelope: any = {
        version: "1.0.0",
        messageId: "pkg_corrupt",
        type: "RECORD_PACKAGE",
        fromInstitution: instA_Id,
        toInstitution: instB_Id,
        globalPatientId,
        scope: "ALL",
        nonce: "nonce_corrupt",
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        payload: {
          requestId: "req_corrupt",
          records: [
            {
              recordId: "0xrec_corrupt",
              fhirMetadata: {
                resourceType: "DiagnosticReport",
                id: "0xrec_corrupt",
                status: "current",
                category: "CARDIOLOGY",
                date: new Date().toISOString(),
                subject: { reference: globalPatientId },
                custodian: { reference: instA_Id, display: "City General" },
                content: {
                  attachment: {
                    contentType: "application/json",
                    hash: "0xexpected_hash",
                    cipherHash: "0xexpected_cipher_hash",
                  },
                },
              },
              encryptedBlobBase64: Buffer.from("TAMPERED_CONTENT").toString("base64"),
              ivBase64: "iv",
              wrappedKeyHex: "0xkey",
              sourceChain: {
                chainIdentifier: "NETWORK-A-CITY-GENERAL",
                blockNumber: 1,
                blockHash: "0xblock",
                merkleProof: [],
                rootHash: "0xroot",
              },
              issuerSignature: "0xsig",
            },
          ],
        },
        signature: "0xsig",
        gatewayPubKey: walletA.publicKey,
      };

      const ingestResult = await coordinator.ingestRecordPackage(gatewayB, corruptEnvelope);
      expect(ingestResult.success).to.be.false;
      expect(ingestResult.reason).to.include("INTEGRITY_VIOLATION");
    });
  });
});
