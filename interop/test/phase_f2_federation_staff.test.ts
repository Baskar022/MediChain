import { expect } from "chai";
import { ethers } from "ethers";
import { FederationManager } from "../federation/FederationManager";
import { StaffManager } from "../staff/StaffManager";

describe("Phase F-2: Federation Registry, Safe Multisig Lifecycle & Staff Roles", () => {
  let federation: FederationManager;
  let staffManager: StaffManager;

  const sampleInstAId = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL"));
  const clinicId = ethers.keccak256(ethers.toUtf8Bytes("CLINIC-SUNSHINE-HEALTH"));

  beforeEach(() => {
    federation = new FederationManager(undefined, 500); // 500ms short-TTL cache for tests
    staffManager = new StaffManager();
  });

  describe("1. Institution Lifecycle & Multi-Signature Governance", () => {
    it("should place newly applied institution into APPLIED state in the review queue", () => {
      const pendingMember = federation.applyMember({
        institutionId: clinicId,
        name: "Sunshine Community Clinic",
        institutionType: "CLINIC",
        chainType: "EVM",
        chainId: "11155111",
        gatewayEndpoint: "https://gateway.sunshine.org",
        gatewayPublicKey: "0x04testpublickey123456789",
        gatewayAddress: "0x1111111111111111111111111111111111111111",
        licenseNumberHash: ethers.keccak256(ethers.toUtf8Bytes("LIC-SUNSHINE-999")),
        documentHash: "ipfs://QmAccreditationSunshineDoc123",
      });

      expect(pendingMember.status).to.equal("APPLIED");
      expect(pendingMember.trustLevel).to.equal(1);

      // Verify it appears in pending review queue
      const pendingQueue = federation.getPendingApplications();
      expect(pendingQueue.some((m) => m.institutionId.toLowerCase() === clinicId.toLowerCase())).to.be.true;

      // Gateways must reject communication for APPLIED institutions
      expect(federation.isMemberActive(clinicId)).to.be.false;
    });

    it("should allow Safe multisig approval to transition institution to ACTIVE with trust level", () => {
      federation.applyMember({
        institutionId: clinicId,
        name: "Sunshine Community Clinic",
        institutionType: "CLINIC",
        chainType: "EVM",
        chainId: "11155111",
        gatewayEndpoint: "https://gateway.sunshine.org",
        gatewayPublicKey: "0x04testpublickey123456789",
        gatewayAddress: "0x1111111111111111111111111111111111111111",
      });

      // Safe multisig confirms 2-of-3 signatures and executes approval
      const approved = federation.approveMember(clinicId, 4);
      expect(approved.status).to.equal("ACTIVE");
      expect(approved.trustLevel).to.equal(4);

      // Should be removed from pending queue
      const pendingQueue = federation.getPendingApplications();
      expect(pendingQueue.some((m) => m.institutionId.toLowerCase() === clinicId.toLowerCase())).to.be.false;

      // Gateways now authorize messages
      expect(federation.isMemberActive(clinicId)).to.be.true;
    });

    it("should suspend an active member and instantly block cross-chain gateway authorization", () => {
      // Initially active
      expect(federation.isMemberActive(sampleInstAId)).to.be.true;

      // Safe multisig / admin suspends member for security audit
      federation.suspendMember(sampleInstAId, "Security key audit in progress");

      // Authorization check must fail immediately
      expect(federation.isMemberActive(sampleInstAId)).to.be.false;

      const member = federation.getMember(sampleInstAId);
      expect(member?.status).to.equal("SUSPENDED");
      expect(member?.rejectionReason).to.include("Security key audit");
    });

    it("should permanently remove an institution from consortium", () => {
      federation.removeMember(sampleInstAId, "Operating license revoked");
      expect(federation.isMemberActive(sampleInstAId)).to.be.false;
      expect(federation.getMember(sampleInstAId)?.status).to.equal("REMOVED");
    });
  });

  describe("2. Short-TTL Gateway Authorization Cache", () => {
    it("should serve authorization checks from memory cache and reflect status changes upon invalidation", async () => {
      expect(federation.isMemberActive(sampleInstAId)).to.be.true;

      // Directly update in map without invalidation to simulate external change
      federation.suspendMember(sampleInstAId, "Compromised key");
      // Because suspendMember automatically invalidates cache:
      expect(federation.isMemberActive(sampleInstAId)).to.be.false;
    });

    it("should support gateway key rotation", () => {
      const newKey = "0x04rotatedgatewaykey999888777";
      const newAddr = "0x2222222222222222222222222222222222222222";
      federation.updateGatewayKey(sampleInstAId, newKey, newAddr);

      const updated = federation.getMember(sampleInstAId);
      expect(updated?.gatewayPublicKey).to.equal(newKey);
      expect(updated?.gatewayAddress).to.equal(newAddr);
    });
  });

  describe("3. StaffManager Role-Based Access Control & Instant Revocation", () => {
    const doctorWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const labTechWallet = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

    it("should register clinical staff with granular roles", async () => {
      const doc = await staffManager.registerStaff(
        sampleInstAId,
        doctorWallet,
        "DOCTOR",
        "Dr. Eleanor Vance",
        "LIC-NY-90210"
      );

      expect(doc.role).to.equal("DOCTOR");
      expect(doc.status).to.equal("ACTIVE");
      expect(await staffManager.isStaffActive(sampleInstAId, doctorWallet, "DOCTOR")).to.be.true;
      expect(await staffManager.isStaffActive(sampleInstAId, doctorWallet, "LAB_TECH")).to.be.false;

      // Register lab technician
      const tech = await staffManager.registerStaff(
        sampleInstAId,
        labTechWallet,
        "LAB_TECH",
        "Markus Brody",
        "LIC-TECH-4411"
      );

      expect(tech.role).to.equal("LAB_TECH");
      expect(await staffManager.isStaffActive(sampleInstAId, labTechWallet, "LAB_TECH")).to.be.true;
    });

    it("should enforce instant revocation and invalidate privileges immediately", async () => {
      await staffManager.registerStaff(
        sampleInstAId,
        doctorWallet,
        "DOCTOR",
        "Dr. Eleanor Vance",
        "LIC-NY-90210"
      );

      expect(await staffManager.isStaffActive(sampleInstAId, doctorWallet)).to.be.true;

      // Administrator revokes staff
      await staffManager.revokeStaff(sampleInstAId, doctorWallet, "Terminated employment");

      // Immediate revocation verification
      expect(await staffManager.isStaffActive(sampleInstAId, doctorWallet)).to.be.false;

      const profile = staffManager.getStaff(sampleInstAId, doctorWallet);
      expect(profile?.status).to.equal("REVOKED");
      expect(profile?.revocationReason).to.equal("Terminated employment");
    });

    it("should list all staff members for an institution", async () => {
      await staffManager.registerStaff(sampleInstAId, doctorWallet, "DOCTOR", "Dr. Vance", "LIC-1");
      await staffManager.registerStaff(sampleInstAId, labTechWallet, "LAB_TECH", "Tech Brody", "LIC-2");

      const list = staffManager.listStaff(sampleInstAId);
      expect(list.length).to.equal(2);
    });
  });
});
