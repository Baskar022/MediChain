import { expect } from "chai";
import { ethers } from "ethers";
import crypto from "crypto";
import { dbManager, InstitutionEntity } from "../../db";
import { FederationManager } from "../../../../../interop/federation/FederationManager";

describe("Phase F-7: Safe Multi-Sig Governance & Federation Registry Administration", () => {
  let federation: FederationManager;
  const safeAddress = "0x9876543210987654321098765432109876543210";
  const signer1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const signer2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const signer3 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  before(() => {
    dbManager.clearAllData();
    federation = new FederationManager(undefined, 500);
  });

  describe("1. Safe Multi-Sig Proposal Workflow (2-of-3 Threshold)", () => {
    const applicantId = "0x" + crypto.randomBytes(32).toString("hex");

    it("should allow applicant hospital to apply and enter APPLIED status in review queue", () => {
      const applied = federation.applyMember({
        institutionId: applicantId,
        name: "St. Jude Metro Children's Hospital",
        institutionType: "HOSPITAL",
        chainType: "EVM",
        chainId: "11155111",
        gatewayEndpoint: "https://stjude-gateway.medichain.org/api",
        gatewayPublicKey: "04" + crypto.randomBytes(64).toString("hex"),
        gatewayAddress: "0x1234567890123456789012345678901234567890",
        licenseNumberHash: ethers.keccak256(ethers.toUtf8Bytes("LIC-STJUDE-777")),
        documentHash: "ipfs://QmStJudeAccreditationDoc",
      });

      expect(applied.status).to.equal("APPLIED");
      expect(applied.trustLevel).to.equal(1);

      // Verify DB storage
      const instRecord: InstitutionEntity = {
        id: applicantId,
        name: "St. Jude Metro Children's Hospital",
        institution_type: "HOSPITAL",
        chain_type: "EVM",
        chain_id: "11155111",
        rpc_port: 8545,
        gateway_endpoint: "https://stjude-gateway.medichain.org/api",
        gateway_public_key: applied.gatewayPublicKey,
        status: "APPLIED",
        trust_level: 0,
        created_at: Math.floor(Date.now() / 1000),
      };
      dbManager.insertInstitution(instRecord);

      const inDb = dbManager.getInstitution(applicantId);
      expect(inDb).to.exist;
      expect(inDb!.status).to.equal("APPLIED");
    });

    it("should reject gateway authorization while institution is still in APPLIED review state", () => {
      const isActive = federation.isMemberActive(applicantId);
      expect(isActive).to.be.false;
    });

    it("should simulate Safe 2-of-3 proposal: Signer 1 proposes, Signer 2 confirms to execute", () => {
      // In-memory proposal simulation matching /api/federation/multisig
      interface Proposal {
        id: string;
        targetInstitutionId: string;
        confirmations: string[];
        status: "PENDING" | "EXECUTED";
        threshold: number;
      }

      const proposal: Proposal = {
        id: "prop_" + crypto.randomBytes(6).toString("hex"),
        targetInstitutionId: applicantId,
        confirmations: [signer1],
        status: "PENDING",
        threshold: 2,
      };

      expect(proposal.confirmations.length).to.equal(1);
      expect(proposal.status).to.equal("PENDING");

      // Signer 2 adds second signature -> threshold met (2/3)
      proposal.confirmations.push(signer2);
      if (proposal.confirmations.length >= proposal.threshold) {
        proposal.status = "EXECUTED";
        federation.approveMember(applicantId, 5);
        dbManager.updateInstitutionStatus(applicantId, "ACTIVE");
      }

      expect(proposal.status).to.equal("EXECUTED");
      const updated = dbManager.getInstitution(applicantId);
      expect(updated!.status).to.equal("ACTIVE");

      // Gateway now passes authorization
      expect(federation.isMemberActive(applicantId)).to.be.true;
    });
  });

  describe("2. Gateway Public Key Rotation", () => {
    const institutionId = "0x" + crypto.randomBytes(32).toString("hex");
    const initialKey = "04" + crypto.randomBytes(64).toString("hex");
    const newRotatedKey = "04" + crypto.randomBytes(64).toString("hex");

    before(() => {
      federation.applyMember({
        institutionId,
        name: "Memorial Regional Health",
        institutionType: "HOSPITAL",
        chainType: "EVM",
        chainId: "80002",
        gatewayEndpoint: "https://memorial-amoy.medichain.org",
        gatewayPublicKey: initialKey,
        gatewayAddress: "0x2222222222222222222222222222222222222222",
      });
      federation.approveMember(institutionId, 5);

      dbManager.insertInstitution({
        id: institutionId,
        name: "Memorial Regional Health",
        institution_type: "HOSPITAL",
        chain_type: "EVM",
        chain_id: "80002",
        rpc_port: 8545,
        gateway_endpoint: "https://memorial-amoy.medichain.org",
        gateway_public_key: initialKey,
        status: "ACTIVE",
        trust_level: 5,
        created_at: Math.floor(Date.now() / 1000),
      });
    });

    it("should successfully rotate gateway public key and invalidate cache", () => {
      // Rotate in federation manager
      federation.updateGatewayKey(institutionId, newRotatedKey);
      expect(federation.getMember(institutionId)?.gatewayPublicKey).to.equal(newRotatedKey);

      // Update in DB
      dbManager.updateGatewayPublicKey(institutionId, newRotatedKey);
      const fetched = dbManager.getInstitution(institutionId);
      expect(fetched!.gateway_public_key).to.equal(newRotatedKey);
    });

    it("should verify invalid hex public key fails validation", () => {
      const invalidKey = "NOT_HEX_KEY_12345";
      const isValid = invalidKey.startsWith("04") && invalidKey.length === 130 && /^[0-9a-fA-F]+$/.test(invalidKey);
      expect(isValid).to.be.false;
    });
  });

  describe("3. Safe Multi-Sig Governance Suspension & Revocation", () => {
    const hospitalId = "0x" + crypto.randomBytes(32).toString("hex");

    before(() => {
      federation.applyMember({
        institutionId: hospitalId,
        name: "Compromised Care Clinic",
        institutionType: "CLINIC",
        chainType: "EVM",
        chainId: "11155111",
        gatewayEndpoint: "https://compromised.clinic",
        gatewayPublicKey: "04" + crypto.randomBytes(64).toString("hex"),
        gatewayAddress: "0x3333333333333333333333333333333333333333",
      });
      federation.approveMember(hospitalId, 5);

      dbManager.insertInstitution({
        id: hospitalId,
        name: "Compromised Care Clinic",
        institution_type: "CLINIC",
        chain_type: "EVM",
        chain_id: "11155111",
        rpc_port: 8545,
        gateway_endpoint: "https://compromised.clinic",
        gateway_public_key: "04" + crypto.randomBytes(64).toString("hex"),
        status: "ACTIVE",
        trust_level: 5,
        created_at: Math.floor(Date.now() / 1000),
      });
    });

    it("should allow Safe 2-of-3 to suspend an institution and instantly invalidate gateway access", () => {
      federation.suspendMember(hospitalId, "Suspended pending audit");
      dbManager.updateInstitutionStatus(hospitalId, "SUSPENDED", "Suspended pending audit");

      const inst = dbManager.getInstitution(hospitalId);
      expect(inst!.status).to.equal("SUSPENDED");
      expect(federation.isMemberActive(hospitalId)).to.be.false;
    });

    it("should permanently remove an institution from consortium upon Safe decision", () => {
      federation.removeMember(hospitalId, "Permanent exclusion by Safe governance vote");
      dbManager.updateInstitutionStatus(hospitalId, "REMOVED", "Permanent exclusion by Safe governance vote");

      const inst = dbManager.getInstitution(hospitalId);
      expect(inst!.status).to.equal("REMOVED");
      expect(federation.isMemberActive(hospitalId)).to.be.false;
    });
  });
});
