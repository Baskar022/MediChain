import { expect } from "chai";
import { ethers } from "ethers";
import { FederationManager } from "../federation/FederationManager";
import { InteropHub } from "../hub/InteropHub";
import { HospitalGateway } from "../gateway/HospitalGateway";
import { EvmAdapter } from "../adapters/EvmAdapter";
import { LedgerAdapter } from "../adapters/LedgerAdapter";
import { CustomLedger } from "../ledger/CustomLedger";
import { deriveGlobalPatientId, deriveLocalPatientPseudonym } from "../types/identity";
import { signEnvelope, MessageEnvelope } from "../types/envelope";

describe("Phase I-8: Cross-Chain Security, Attack Vectors & Adversarial Protections", () => {
  let federation: FederationManager;
  let hub: InteropHub;

  let walletA: ethers.HDNodeWallet;
  let walletB: ethers.HDNodeWallet;
  let walletC: ethers.HDNodeWallet;

  let gatewayA: HospitalGateway;
  let gatewayB: HospitalGateway;
  let gatewayC: HospitalGateway;

  let ledgerAdapterC: LedgerAdapter;

  const instA_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL"));
  const instB_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY"));
  const instC_Id = ethers.keccak256(ethers.toUtf8Bytes("LAB-METRO-DIAGNOSTICS"));

  const globalPatientId = deriveGlobalPatientId("SECURITY-AUDIT-PATIENT-ALICE");

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

    ledgerAdapterC = new LedgerAdapter({
      chainIdentifier: "NETWORK-C-METRO-LAB",
    });

    gatewayC = new HospitalGateway({
      institutionId: instC_Id,
      name: "Metro Diagnostics Lab",
      adapter: ledgerAdapterC,
      federation,
      hub,
      gatewaySigner: walletC,
    });
  });

  describe("1. Replay Attack Protections", () => {
    it("should reject message replay when duplicate messageId is re-sent", async () => {
      const now = Math.floor(Date.now() / 1000);
      const envelope = await signEnvelope(
        {
          messageId: "ENV-SEC-REPLAY-001",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "CARDIOLOGY",
          nonce: "nonce_sec_101",
          issuedAt: now,
          expiresAt: now + 3600,
          payload: { clinicalReason: "Routine consultation" },
          gatewayPubKey: walletB.publicKey,
        },
        walletB
      );

      const res1 = await hub.routeMessage(envelope);
      expect(res1.status).to.equal("DELIVERED");

      // Replayed identical envelope must be rejected by Anti-Replay cache
      const res2 = await hub.routeMessage(envelope);
      expect(res2.status).to.equal("REJECTED");
      expect(res2.reason).to.include("REPLAY_ATTACK_DETECTED");
    });

    it("should reject reuse of an already consumed nonce", async () => {
      const now = Math.floor(Date.now() / 1000);
      const consumedNonce = "nonce_fixed_reuse_44";

      const envelope1 = await signEnvelope(
        {
          messageId: "ENV-NONCE-1",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "CARDIOLOGY",
          nonce: consumedNonce,
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
          messageId: "ENV-NONCE-2", // Different messageId
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "CARDIOLOGY",
          nonce: consumedNonce, // Same nonce reused
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
  });

  describe("2. Cryptographic Attestation & Forged Signature Detection", () => {
    it("should reject envelope signed by an unauthorized rogue key", async () => {
      const rogueWallet = ethers.Wallet.createRandom();
      const now = Math.floor(Date.now() / 1000);

      const forgedEnvelope = await signEnvelope(
        {
          messageId: "ENV-FORGED-001",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id, // Claiming to be Hospital B
          toInstitution: instA_Id,
          globalPatientId,
          scope: "ALL",
          nonce: "nonce_forged_99",
          issuedAt: now,
          expiresAt: now + 3600,
          payload: {},
          gatewayPubKey: rogueWallet.publicKey,
        },
        rogueWallet
      );

      const result = await hub.routeMessage(forgedEnvelope);
      expect(result.status).to.equal("REJECTED");
      expect(result.reason).to.include("SIGNATURE_AUTHORITY_MISMATCH");
    });

    it("should reject tampered message envelopes where payload was altered after signing", async () => {
      const now = Math.floor(Date.now() / 1000);

      const authenticEnvelope = await signEnvelope(
        {
          messageId: "ENV-TAMPER-001",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "CARDIOLOGY_ONLY",
          nonce: "nonce_tamper_100",
          issuedAt: now,
          expiresAt: now + 3600,
          payload: { requestedScope: "CARDIOLOGY_ONLY" },
          gatewayPubKey: walletB.publicKey,
        },
        walletB
      );

      // Adversary modifies payload in transit without resigning
      authenticEnvelope.payload.requestedScope = "FULL_HISTORY_ALL_RECORDS";

      const result = await hub.routeMessage(authenticEnvelope);
      expect(result.status).to.equal("REJECTED");
      expect(result.reason).to.include("SIGNATURE");
    });
  });

  describe("3. Federation Status Enforcement & Suspended Members", () => {
    it("should reject communication from or to a suspended hospital", async () => {
      // Suspend Hospital B
      federation.updateMemberStatus(instB_Id, "SUSPENDED");

      const res = await gatewayB.sendCrossChainMessage(
        "REQUEST_RECORDS",
        instA_Id,
        globalPatientId,
        "CARDIOLOGY",
        { reason: "Consultation" }
      );

      expect(res.status).to.equal("REJECTED");
      expect(res.reason).to.include("suspended");

      // Reactivate Hospital B
      federation.updateMemberStatus(instB_Id, "ACTIVE");
    });
  });

  describe("4. Consent Expiry & Real-Time Revocation Enforcement", () => {
    it("should reject consent checks when consent timestamp has expired", async () => {
      const localPseudonym = deriveLocalPatientPseudonym(globalPatientId, instC_Id);

      // Grant consent that expired 1 hour ago
      await ledgerAdapterC.grantConsent(
        localPseudonym,
        instB_Id,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "METABOLIC_PANEL",
        Math.floor(Date.now() / 1000) - 3600 // Expired
      );

      const check = await ledgerAdapterC.checkConsent(localPseudonym, instB_Id, "0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(check.hasAccess).to.be.false;
    });

    it("should instantly invalidate access upon on-chain patient revocation", async () => {
      const localPseudonym = deriveLocalPatientPseudonym(globalPatientId, instC_Id);

      // Grant valid 30-day consent
      const grant = await ledgerAdapterC.grantConsent(
        localPseudonym,
        instB_Id,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "METABOLIC_PANEL",
        Math.floor(Date.now() / 1000) + 86400 * 30
      );

      const check1 = await ledgerAdapterC.checkConsent(localPseudonym, instB_Id, "0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(check1.hasAccess).to.be.true;

      // Patient revokes consent immediately using consentId
      await ledgerAdapterC.revokeConsent(grant.consentId);

      const check2 = await ledgerAdapterC.checkConsent(localPseudonym, instB_Id, "0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(check2.hasAccess).to.be.false;
    });
  });

  describe("5. Malicious Ciphertext & Merkle Proof Tamper Rejection", () => {
    it("should reject record package ingestion when ciphertext has been tampered", async () => {
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
              cipherHash: "0x0000000000000000000000000000000000000000000000000000000000000000", // Mismatched hash
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

      const tamperedEnvelope: MessageEnvelope = {
        version: "1.0.0",
        messageId: "msg_tampered_pkg",
        type: "RECORD_PACKAGE",
        fromInstitution: instA_Id,
        toInstitution: instB_Id,
        globalPatientId,
        scope: "CARDIOLOGY",
        nonce: "nonce_tamper_pkg",
        issuedAt: now,
        expiresAt: now + 3600,
        payload: {
          records: [fakeItem],
        },
        signature: "0xsig",
        gatewayPubKey: walletA.publicKey,
      };

      const anchorResult = await gatewayB.handleIncomingRecordPackage(tamperedEnvelope);
      expect(anchorResult.success).to.be.false;
      expect(anchorResult.error).to.include("INTEGRITY_VIOLATION");
    });
  });

  describe("6. Stale Envelope Message Expiry", () => {
    it("should reject message envelope when expiresAt timestamp has lapsed", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 60;

      const expiredEnvelope = await signEnvelope(
        {
          messageId: "ENV-EXPIRED-STALE-001",
          type: "REQUEST_RECORDS",
          fromInstitution: instB_Id,
          toInstitution: instA_Id,
          globalPatientId,
          scope: "CARDIOLOGY",
          nonce: "nonce_expired_1",
          issuedAt: pastTime - 300,
          expiresAt: pastTime, // Lapsed
          payload: {},
          gatewayPubKey: walletB.publicKey,
        },
        walletB
      );

      const result = await hub.routeMessage(expiredEnvelope);
      expect(result.status).to.equal("REJECTED");
      expect(result.reason).to.include("EXPIRED");
    });
  });
});
