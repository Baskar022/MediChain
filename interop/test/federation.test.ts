import { expect } from "chai";
import { ethers } from "ethers";
import { FederationManager, DEFAULT_FEDERATION_MEMBERS } from "../federation/FederationManager";
import {
  signEnvelope,
  verifyEnvelopeSignature,
  isEnvelopeExpired,
  MessageEnvelope,
} from "../types/envelope";
import {
  deriveGlobalPatientId,
  deriveLocalPatientPseudonym,
  createPatientControlSignature,
  verifyPatientControlSignature,
} from "../types/identity";

describe("Phase I-2: Federation Directory, Message Envelopes & Universal Patient Identity", () => {
  describe("1. Federation Directory & Trust Layer", () => {
    let federation: FederationManager;

    beforeEach(() => {
      federation = new FederationManager();
    });

    it("should load standard default autonomous members (Networks A, B, C)", () => {
      const members = federation.getAllMembers();
      expect(members).to.have.lengthOf(3);

      const hospitalA = federation.getMember(DEFAULT_FEDERATION_MEMBERS[0].institutionId);
      expect(hospitalA).to.exist;
      expect(hospitalA!.name).to.equal("City General Hospital");
      expect(hospitalA!.chainType).to.equal("EVM");

      const labC = federation.getMember(DEFAULT_FEDERATION_MEMBERS[2].institutionId);
      expect(labC).to.exist;
      expect(labC!.name).to.equal("Metro Diagnostics Lab");
      expect(labC!.chainType).to.equal("PERMISSIONED_LEDGER");
    });

    it("should allow onboarding of new member institutions", () => {
      const newInstId = ethers.keccak256(ethers.toUtf8Bytes("CLINIC-VALLEY-FAMILY"));
      federation.onboardMember({
        institutionId: newInstId,
        name: "Valley Family Medicine",
        institutionType: "CLINIC",
        chainType: "EVM",
        chainId: "31339",
        gatewayEndpoint: "http://localhost:8548",
        gatewayPublicKey: "0x0411223344...",
        gatewayAddress: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
        status: "ACTIVE",
        trustLevel: 3,
        onboardedAt: Math.floor(Date.now() / 1000),
      });

      expect(federation.isMemberActive(newInstId)).to.be.true;
      const clinic = federation.getMember(newInstId);
      expect(clinic!.institutionType).to.equal("CLINIC");
    });

    it("should allow suspension and reactivation of a member institution", () => {
      const targetId = DEFAULT_FEDERATION_MEMBERS[0].institutionId;

      federation.updateMemberStatus(targetId, "SUSPENDED");
      expect(federation.isMemberActive(targetId)).to.be.false;

      federation.updateMemberStatus(targetId, "ACTIVE");
      expect(federation.isMemberActive(targetId)).to.be.true;
    });
  });

  describe("2. Privacy-Preserving Record Locator Index", () => {
    let federation: FederationManager;
    const globalPatientId = deriveGlobalPatientId("ALICE-VANCE-SSN-9021");

    beforeEach(() => {
      federation = new FederationManager();
    });

    it("should index where records exist across sovereign chains without clinical content", () => {
      const instA = DEFAULT_FEDERATION_MEMBERS[0].institutionId;
      const instC = DEFAULT_FEDERATION_MEMBERS[2].institutionId;

      // Hospital A holds Cardiology records
      federation.updateRecordLocator(globalPatientId, instA, "NETWORK-A-CITY-GENERAL", "CARDIOLOGY", 2);

      // Lab C holds Hematology lab results
      federation.updateRecordLocator(globalPatientId, instC, "NETWORK-C-METRO-LAB", "HEMATOLOGY", 4);

      const locator = federation.queryRecordLocator(globalPatientId);
      expect(locator).to.have.lengthOf(2);

      expect(locator[0].institutionName).to.equal("City General Hospital");
      expect(locator[0].recordType).to.equal("CARDIOLOGY");
      expect(locator[0].recordCount).to.equal(2);

      expect(locator[1].institutionName).to.equal("Metro Diagnostics Lab");
      expect(locator[1].recordType).to.equal("HEMATOLOGY");
      expect(locator[1].recordCount).to.equal(4);
    });

    it("should allow patient to opt out / hide locator index from federated search", () => {
      const instA = DEFAULT_FEDERATION_MEMBERS[0].institutionId;
      federation.updateRecordLocator(globalPatientId, instA, "NETWORK-A-CITY-GENERAL", "CARDIOLOGY", 1);

      // Patient hides locator
      federation.setPatientVisibility(globalPatientId, false);
      expect(() => federation.queryRecordLocator(globalPatientId)).to.throw(
        "Patient has chosen to hide their record locator index"
      );

      // Patient unhides
      federation.setPatientVisibility(globalPatientId, true);
      const res = federation.queryRecordLocator(globalPatientId);
      expect(res).to.have.lengthOf(1);
    });
  });

  describe("3. Standard Cross-Chain Message Envelope & Verification", () => {
    let gatewaySigner: ethers.HDNodeWallet;

    beforeEach(() => {
      gatewaySigner = ethers.Wallet.createRandom();
    });

    it("should construct, sign, and verify a valid message envelope", async () => {
      const globalPatientId = deriveGlobalPatientId("ALICE-VANCE-SSN-9021");

      const envelope = await signEnvelope(
        {
          messageId: "msg_relocation_001",
          type: "REQUEST_RECORDS",
          fromInstitution: "HOSPITAL-REGIONAL-SPECIALTY",
          toInstitution: "HOSPITAL-CITY-GENERAL",
          globalPatientId,
          scope: "ALL_RECORDS",
          nonce: "nonce_12345678",
          issuedAt: Math.floor(Date.now() / 1000),
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          payload: {
            reason: "Patient relocation to North District",
            urgency: "ROUTINE",
            requestingDoctorName: "Dr. Robert Miller",
            requestingDoctorLicense: "MED-NY-44120",
          },
          gatewayPubKey: gatewaySigner.publicKey,
        },
        gatewaySigner
      );

      expect(envelope.version).to.equal("1.0.0");
      expect(envelope.signature).to.be.a("string");

      // Verify envelope signature
      const verification = verifyEnvelopeSignature(envelope);
      expect(verification.isValid).to.be.true;
      expect(verification.recoveredAddress.toLowerCase()).to.equal(gatewaySigner.address.toLowerCase());
      expect(isEnvelopeExpired(envelope)).to.be.false;
    });

    it("should detect tampering in message envelope contents", async () => {
      const envelope = await signEnvelope(
        {
          messageId: "msg_tamper_test",
          type: "REQUEST_RECORDS",
          fromInstitution: "HOSPITAL-REGIONAL-SPECIALTY",
          toInstitution: "HOSPITAL-CITY-GENERAL",
          globalPatientId: "0x1234",
          scope: "CARDIOLOGY",
          nonce: "nonce_999",
          issuedAt: Math.floor(Date.now() / 1000),
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          payload: { reason: "Routine" },
          gatewayPubKey: gatewaySigner.publicKey,
        },
        gatewaySigner
      );

      // Malicious actor alters scope or payload
      const tamperedEnvelope: MessageEnvelope = {
        ...envelope,
        scope: "ALL_CONFIDENTIAL_PSYCH_RECORDS",
      };

      const verification = verifyEnvelopeSignature(tamperedEnvelope);
      // Recovered address will not match gatewaySigner because digest changed
      expect(verification.recoveredAddress.toLowerCase()).to.not.equal(gatewaySigner.address.toLowerCase());
    });

    it("should flag expired envelopes", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 100;
      const envelope = await signEnvelope(
        {
          messageId: "msg_expired",
          type: "REQUEST_RECORDS",
          fromInstitution: "HOSPITAL-A",
          toInstitution: "HOSPITAL-B",
          globalPatientId: "0x1234",
          scope: "ALL",
          nonce: "nonce_exp",
          issuedAt: pastTime - 300,
          expiresAt: pastTime,
          payload: {},
          gatewayPubKey: gatewaySigner.publicKey,
        },
        gatewaySigner
      );

      expect(isEnvelopeExpired(envelope)).to.be.true;
    });
  });

  describe("4. Universal Pseudonymous Patient Identity & Proof of Control", () => {
    let patientSigner: ethers.HDNodeWallet;

    beforeEach(() => {
      patientSigner = ethers.Wallet.createRandom();
    });

    it("should derive deterministic Global Patient ID with zero PII", () => {
      const ssn = "123-45-6789";
      const gpi1 = deriveGlobalPatientId(ssn);
      const gpi2 = deriveGlobalPatientId(ssn);

      expect(gpi1).to.equal(gpi2);
      expect(gpi1).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(gpi1).to.not.include("123");
      expect(gpi1).to.not.include("45");
    });

    it("should derive unlinkable institution-specific local pseudonyms", () => {
      const globalId = deriveGlobalPatientId("ALICE-VANCE");
      const localA = deriveLocalPatientPseudonym(globalId, "HOSPITAL-CITY-GENERAL");
      const localB = deriveLocalPatientPseudonym(globalId, "HOSPITAL-REGIONAL-SPECIALTY");

      expect(localA).to.not.equal(localB);
      expect(localA).to.match(/^0x[a-fA-F0-9]{64}$/);
      expect(localB).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should generate and verify patient cryptographic proof of control", async () => {
      const globalId = deriveGlobalPatientId("ALICE-VANCE");
      const action = "APPROVE_CROSS_CHAIN_RELOCATION_TRANSFER";

      const sig = await createPatientControlSignature(patientSigner, globalId, action);
      expect(sig).to.be.a("string");

      const isValid = verifyPatientControlSignature(
        [
          "MediChain Interoperability Control Proof",
          `Global Patient ID: ${globalId}`,
          `Authorized Action: ${action}`,
          `Timestamp: ${Math.floor(Date.now() / 1000)}`,
        ].join("\n"),
        sig,
        patientSigner.address
      );

      expect(isValid).to.be.true;
    });
  });
});
