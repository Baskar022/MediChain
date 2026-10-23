import { expect } from "chai";
import { ethers } from "ethers";
import { FederationManager } from "../federation/FederationManager";
import { InteropHub } from "../hub/InteropHub";
import { HospitalGateway } from "../gateway/HospitalGateway";
import { EvmAdapter } from "../adapters/EvmAdapter";
import { LedgerAdapter } from "../adapters/LedgerAdapter";
import { CrossChainSharingCoordinator } from "../flows/SharingFlow";
import { RevocationAndLabPushService } from "../flows/RevocationAndLabPush";
import { deriveGlobalPatientId } from "../types/identity";

describe("Phase I-5: Revocation Propagation, Standing Consent Lab Push & Cross-Chain Verify", () => {
  let federation: FederationManager;
  let hub: InteropHub;
  let sharingCoordinator: CrossChainSharingCoordinator;
  let revocationLabService: RevocationAndLabPushService;

  let walletA: ethers.HDNodeWallet;
  let walletB: ethers.HDNodeWallet;
  let walletC: ethers.HDNodeWallet;
  let patientWallet: ethers.HDNodeWallet;

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
    sharingCoordinator = new CrossChainSharingCoordinator(federation, hub);
    revocationLabService = new RevocationAndLabPushService(federation, hub);

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

  describe("1. FLOW B: Cross-Chain Revocation Propagation", () => {
    const recordId = "0xrec_cardio_revokable_001";
    let consentId: string;

    beforeEach(async () => {
      // 1. Setup shared record
      const clinical = JSON.stringify({ diagnosis: "Mild Hypertension" });
      const plaintextHash = ethers.sha256(ethers.toUtf8Bytes(clinical));
      const sig = await walletA.signMessage(ethers.getBytes(plaintextHash));
      const ciphertext = Buffer.from(clinical).toString("base64");

      gatewayA.addLocalRecord({
        recordId,
        patientIdHash: globalPatientId,
        recordHash: plaintextHash,
        cipherHash: ethers.sha256(ethers.toUtf8Bytes(ciphertext)),
        recordType: "CARDIOLOGY",
        encryptedBlobBase64: ciphertext,
        ivBase64: "aXY=",
        rawRecordKeyHex: "0xkey",
        issuerDoctorSignature: sig,
      });

      const consentResult = await sharingCoordinator.grantPatientConsent(
        gatewayA,
        patientWallet,
        globalPatientId,
        instB_Id,
        "CARDIOLOGY"
      );
      consentId = consentResult.consentId;

      const pkg = await sharingCoordinator.releaseRecordPackage(
        gatewayA,
        instB_Id,
        globalPatientId,
        "CARDIOLOGY"
      );
      await sharingCoordinator.ingestRecordPackage(gatewayB, pkg.envelope);
    });

    it("should propagate patient revocation and lock foreign record access immediately", async () => {
      // Initially, access is granted
      const preView = await sharingCoordinator.decryptAndAccessRecord(
        gatewayB,
        gatewayA,
        recordId,
        "0xdoctor_miller"
      );
      expect(preView.integrityBadge).to.equal("VERIFIED_AUTHENTIC");
      expect(preView.consentStatus.isRevoked).to.be.false;

      // Patient executes revocation
      const revokeResult = await revocationLabService.propagateRevocation(
        gatewayA,
        instB_Id,
        globalPatientId,
        consentId,
        "Patient changed primary healthcare provider"
      );

      expect(revokeResult.status).to.equal("DELIVERED");
      expect(revokeResult.invalidatedCount).to.be.greaterThan(0);

      // Verify that destination gateway has marked ForeignRecordRef as revoked
      const ref = gatewayB.getForeignRecord(recordId);
      expect(ref).to.exist;
      expect(ref!.isRevoked).to.be.true;

      // Subsequent access attempts MUST return CONSENT_REVOKED and withhold clinical content
      const postView = await sharingCoordinator.decryptAndAccessRecord(
        gatewayB,
        gatewayA,
        recordId,
        "0xdoctor_miller"
      );
      expect(postView.integrityBadge).to.equal("CONSENT_REVOKED");
      expect(postView.clinicalData).to.be.null;
      expect(postView.consentStatus.isRevoked).to.be.true;
    });
  });

  describe("2. FLOW D: Standing Consent Diagnostic Lab Push", () => {
    it("should push signed lab result from Network C to ordering Hospital B directly", async () => {
      const pushResult = await revocationLabService.pushLabResult(
        gatewayC,
        gatewayB,
        globalPatientId,
        {
          testId: "0xrec_lab_blood_work_777",
          testType: "HEMATOLOGY",
          clinicalJson: JSON.stringify({
            test: "Complete Blood Count (CBC) with Differential",
            wbc: "6.8 x10^3/uL",
            rbc: "4.72 x10^6/uL",
            hemoglobin: "14.2 g/dL",
            platelets: "245 x10^3/uL",
          }),
          orderingDoctorName: "Dr. Robert Miller",
        }
      );

      expect(pushResult.success).to.be.true;
      expect(pushResult.recordId).to.equal("0xrec_lab_blood_work_777");

      // Verify ForeignRecordRef is now anchored at Gateway B
      const ref = gatewayB.getForeignRecord("0xrec_lab_blood_work_777");
      expect(ref).to.exist;
      expect(ref!.sourceInstitutionId).to.equal(instC_Id);
      expect(ref!.sourceChainId).to.equal("NETWORK-C-METRO-LAB");
    });
  });

  describe("3. FLOW E: Cross-Chain Authenticity Verification", () => {
    it("should verify anchored record on custom permissioned ledger (Network C)", async () => {
      const recordId = "0xrec_pathology_proven_001";
      gatewayC.addLocalRecord({
        recordId,
        patientIdHash: globalPatientId,
        recordHash: "0xplainhash",
        cipherHash: "0xcipherhash",
        recordType: "PATHOLOGY",
        encryptedBlobBase64: "YmxvYg==",
        ivBase64: "aXY=",
        rawRecordKeyHex: "0xkey",
        issuerDoctorSignature: "0xsig",
      });

      const report = await revocationLabService.verifyAcrossChains(gatewayC, recordId);
      expect(report.isAnchored).to.be.true;
      expect(report.status).to.equal("VERIFIED_AUTHENTIC");
      expect(report.sourceChain.institutionName).to.equal("Metro Diagnostics Lab");
      expect(report.sourceChain.chainType).to.equal("PERMISSIONED_LEDGER");
      expect(report.details).to.include("Block #");
    });

    it("should return NOT_FOUND for unknown hash on queried network", async () => {
      const report = await revocationLabService.verifyAcrossChains(gatewayA, "0xunknown_hash_999");
      expect(report.isAnchored).to.be.false;
      expect(report.status).to.equal("NOT_FOUND");
    });
  });
});
