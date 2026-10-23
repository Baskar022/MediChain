import { expect } from "chai";
import { ethers } from "ethers";
import { FederationManager } from "../federation/FederationManager";
import { InteropHub } from "../hub/InteropHub";
import { HospitalGateway } from "../gateway/HospitalGateway";
import { EvmAdapter } from "../adapters/EvmAdapter";
import { LedgerAdapter } from "../adapters/LedgerAdapter";
import { deriveGlobalPatientId } from "../types/identity";
import { signEnvelope, MessageEnvelope } from "../types/envelope";

describe("Phase I-3: Hospital Gateways, Interop Hub & Cross-Chain Security", () => {
  let federation: FederationManager;
  let hub: InteropHub;

  let walletA: ethers.HDNodeWallet;
  let walletB: ethers.HDNodeWallet;
  let walletC: ethers.HDNodeWallet;

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

  describe("1. Interop Hub Routing & Delivery", () => {
    it("should route valid signed envelope between authorized hospitals", async () => {
      const result = await gatewayB.sendCrossChainMessage(
        "REQUEST_RECORDS",
        instA_Id,
        globalPatientId,
        "ALL_RECORDS",
        {
          reason: "Patient relocation care intake",
          urgency: "ROUTINE",
          requestingDoctorName: "Dr. Robert Miller",
          requestingDoctorLicense: "MED-NY-44120",
        }
      );

      expect(result.status).to.equal("DELIVERED");
      expect(result.messageId).to.be.a("string");
    });

    it("should reject duplicate messageId (Anti-Replay Attack Protection)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const envelope = await signEnvelope(
        {
          messageId: "msg_replay_unique_101",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "ALL_RECORDS",
          nonce: "nonce_unique_1",
          issuedAt: now,
          expiresAt: now + 3600,
          payload: { reason: "Initial request" },
          gatewayPubKey: walletB.publicKey,
        },
        walletB
      );

      // First submission succeeds
      const first = await hub.routeMessage(envelope);
      expect(first.status).to.equal("DELIVERED");

      // Replayed submission with same messageId must be rejected
      const replay = await hub.routeMessage(envelope);
      expect(replay.status).to.equal("REJECTED");
      expect(replay.reason).to.include("REPLAY_ATTACK_DETECTED");
    });

    it("should reject duplicate nonce from same sender", async () => {
      const now = Math.floor(Date.now() / 1000);
      const sharedNonce = "shared_nonce_fixed_123";

      const envelope1 = await signEnvelope(
        {
          messageId: "msg_nonce_1",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "ALL",
          nonce: sharedNonce,
          issuedAt: now,
          expiresAt: now + 3600,
          payload: {},
          gatewayPubKey: walletB.publicKey,
        },
        walletB
      );

      const res1 = await hub.routeMessage(envelope1);
      expect(res1.status).to.equal("DELIVERED");

      const envelope2 = await signEnvelope(
        {
          messageId: "msg_nonce_2", // Different ID, but same nonce
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "ALL",
          nonce: sharedNonce,
          issuedAt: now,
          expiresAt: now + 3600,
          payload: {},
          gatewayPubKey: walletB.publicKey,
        },
        walletB
      );

      const res2 = await hub.routeMessage(envelope2);
      expect(res2.status).to.equal("REJECTED");
      expect(res2.reason).to.include("duplicate nonce");
    });

    it("should reject forged or unauthorized gateway signer", async () => {
      const attackerWallet = ethers.Wallet.createRandom();
      const now = Math.floor(Date.now() / 1000);

      // Claiming to be instB_Id, but signed by rogue attacker wallet
      const forgedEnvelope = await signEnvelope(
        {
          messageId: "msg_forged",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "ALL",
          nonce: "nonce_forged",
          issuedAt: now,
          expiresAt: now + 3600,
          payload: { reason: "Spying" },
          gatewayPubKey: attackerWallet.publicKey,
        },
        attackerWallet
      );

      const result = await hub.routeMessage(forgedEnvelope);
      expect(result.status).to.equal("REJECTED");
      expect(result.reason).to.include("SIGNATURE_AUTHORITY_MISMATCH");
    });

    it("should reject communication if an institution is suspended", async () => {
      // Suspend City General in federation
      federation.updateMemberStatus(instA_Id, "SUSPENDED");

      const result = await gatewayB.sendCrossChainMessage(
        "REQUEST_RECORDS",
        instA_Id,
        globalPatientId,
        "ALL_RECORDS",
        { reason: "Routine" }
      );

      expect(result.status).to.equal("REJECTED");
      expect(result.reason).to.include("RECIPIENT_INACTIVE");
    });
  });

  describe("2. Fault Tolerance & Exponential Backoff Retries", () => {
    it("should queue envelope when destination gateway is offline and deliver upon recovery", async () => {
      // Take Gateway A offline
      gatewayA.setOnline(false);

      const sendResult = await gatewayB.sendCrossChainMessage(
        "REQUEST_RECORDS",
        instA_Id,
        globalPatientId,
        "ALL_RECORDS",
        { reason: "Transfer intake" }
      );

      expect(sendResult.status).to.equal("QUEUED");
      expect(hub.getQueueLength()).to.equal(1);

      // Bring Gateway A back online
      gatewayA.setOnline(true);

      // Process retries with force=true
      const retryResult = await hub.processRetries(true);
      expect(retryResult.delivered).to.equal(1);
      expect(hub.getQueueLength()).to.equal(0);
    });
  });

  describe("3. Gateway Record Package Attestation & Anchor", () => {
    it("should verify ciphertext hash and inclusion proof before anchoring foreign records", async () => {
      // 1. Author a medical record on City General (Gateway A)
      const recordPayload = JSON.stringify({
        diagnosis: "Atrial Fibrillation - Paroxysmal",
        ecgWaveform: "Irregular R-R intervals, absent P-waves",
      });
      const ciphertext = Buffer.from(recordPayload).toString("base64");
      const recordHash = ethers.sha256(ethers.toUtf8Bytes(recordPayload));
      const cipherHash = ethers.sha256(ethers.toUtf8Bytes(ciphertext));
      const recordId = "0xrec_cardio_101";

      gatewayA.addLocalRecord({
        recordId,
        patientIdHash: globalPatientId,
        recordHash,
        cipherHash,
        recordType: "CARDIOLOGY",
        encryptedBlobBase64: ciphertext,
        ivBase64: "dGVzdF9pdl8xMg==",
        rawRecordKeyHex: "0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
        issuerDoctorSignature: "0xdoctor_sig",
      });

      // 2. Gateway B requests records
      const reqResult = await gatewayB.sendCrossChainMessage(
        "REQUEST_RECORDS",
        instA_Id,
        globalPatientId,
        "CARDIOLOGY",
        {
          reason: "Referral consultation",
          urgency: "ROUTINE",
          requestingDoctorName: "Dr. Miller",
          requestingDoctorLicense: "LIC-123",
        }
      );

      expect(reqResult.status).to.equal("DELIVERED");
      expect(reqResult.responsePayload.recordCount).to.equal(1);

      const recordItem = reqResult.responsePayload.records[0];

      // 3. Gateway B receives and verifies the package
      const now = Math.floor(Date.now() / 1000);
      const pkgEnvelope: MessageEnvelope = {
        version: "1.0.0",
        messageId: "msg_pkg_delivery",
        type: "RECORD_PACKAGE",
        fromInstitution: instA_Id,
        toInstitution: instB_Id,
        globalPatientId,
        scope: "CARDIOLOGY",
        nonce: "nonce_pkg",
        issuedAt: now,
        expiresAt: now + 3600,
        payload: {
          requestId: reqResult.messageId,
          records: [recordItem],
          sourceGatewayAttestation: "0xattestation_sig",
        },
        signature: "0xsig",
        gatewayPubKey: walletA.publicKey,
      };

      const anchorResult = await gatewayB.handleIncomingRecordPackage(pkgEnvelope);
      expect(anchorResult.success).to.be.true;

      // 4. Verify ForeignRecordRef is securely anchored at Gateway B
      const foreignRef = gatewayB.getForeignRecord(recordId);
      expect(foreignRef).to.exist;
      expect(foreignRef!.sourceInstitutionId).to.equal(instA_Id);
      expect(foreignRef!.isRevoked).to.be.false;
      expect(foreignRef!.cipherHash).to.equal(cipherHash);
    });

    it("should reject tampered ciphertext in record package", async () => {
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
              cipherHash: "0x0000000000000000000000000000000000000000000000000000000000000000", // Mismatch
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
          sourceGatewayAttestation: "0xsig",
        },
        signature: "0xsig",
        gatewayPubKey: walletA.publicKey,
      };

      const result = await gatewayB.handleIncomingRecordPackage(badEnvelope);
      expect(result.success).to.be.false;
      expect(result.error).to.include("INTEGRITY_VIOLATION");
    });
  });
});
