import { expect } from "chai";
import { ethers } from "ethers";
import { FederationManager } from "../federation/FederationManager";
import { InteropHub } from "../hub/InteropHub";
import { HospitalGateway } from "../gateway/HospitalGateway";
import { EvmAdapter } from "../adapters/EvmAdapter";
import { LedgerAdapter } from "../adapters/LedgerAdapter";
import { EmergencyBreakGlassService } from "../flows/EmergencyBreakGlassFlow";
import { deriveGlobalPatientId } from "../types/identity";

describe("Phase I-6: Cross-Chain Emergency Break-Glass & Admin Review Queue", () => {
  let federation: FederationManager;
  let hub: InteropHub;
  let emergencyService: EmergencyBreakGlassService;

  let walletA: ethers.HDNodeWallet;
  let walletB: ethers.HDNodeWallet;
  let doctorMillerWallet: ethers.HDNodeWallet;

  let gatewayA: HospitalGateway; // City General (Network A - EVM)
  let gatewayB: HospitalGateway; // Regional Specialty (Network B - EVM)

  const instA_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL"));
  const instB_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY"));

  const globalPatientId = deriveGlobalPatientId("ALICE-VANCE-SSN-9021");

  beforeEach(async () => {
    walletA = ethers.Wallet.createRandom();
    walletB = ethers.Wallet.createRandom();
    doctorMillerWallet = ethers.Wallet.createRandom();

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
    ]);

    hub = new InteropHub(federation);
    emergencyService = new EmergencyBreakGlassService(federation, hub);

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
  });

  describe("1. Cross-Chain Emergency Break-Glass Execution", () => {
    it("should bypass standard prior consent and release 24h critical summary", async () => {
      const now = Math.floor(Date.now() / 1000);

      const result = await emergencyService.executeCrossChainEmergencyBreakGlass({
        requestingGateway: gatewayB,
        sourceInstitutionId: instA_Id,
        globalPatientId,
        doctorWallet: doctorMillerWallet.address,
        doctorName: "Dr. Robert Miller, DO",
        clinicalJustification: "Acute polytrauma; GCS 6; patient intubated following motor vehicle collision.",
        emergencyLevel: "LEVEL_1_TRAUMA",
        timeBoxSeconds: 86400, // 24 hours
        emergencyContactPhone: "+1 (555) 992-1200",
      });

      expect(result.success).to.be.true;
      expect(result.emergencyAccessId).to.be.a("string");

      // Time-box verification
      expect(result.expiresAt).to.be.closeTo(now + 86400, 5);

      // Critical Summary verification
      const summary = result.criticalSummary;
      expect(summary).to.exist;
      expect(summary!.bloodGroup).to.include("O-Negative");
      expect(summary!.severeAllergies).to.include("Penicillin (Anaphylactic Shock - Grade 4)");
      expect(summary!.activeMedications).to.be.an("array").with.lengthOf(3);
      expect(summary!.emergencyContact.name).to.equal("Robert Vance (Spouse)");
    });

    it("should notify patient in-app and flag emergency contact notification", async () => {
      await emergencyService.executeCrossChainEmergencyBreakGlass({
        requestingGateway: gatewayB,
        sourceInstitutionId: instA_Id,
        globalPatientId,
        doctorWallet: doctorMillerWallet.address,
        doctorName: "Dr. Robert Miller, DO",
        clinicalJustification: "Cardiac arrest resuscitation in ER.",
        emergencyLevel: "RESUSCITATION",
      });

      const alerts = emergencyService.getPatientEmergencyAlerts(globalPatientId);
      expect(alerts).to.have.lengthOf(1);
      expect(alerts[0].accessingHospitalName).to.equal("Regional Specialty Hospital");
      expect(alerts[0].emergencyContactNotified).to.be.true;
      expect(alerts[0].reviewedByPatient).to.be.false;

      // Patient acknowledges alert
      emergencyService.acknowledgePatientAlert(globalPatientId, alerts[0].alertId);
      const updatedAlerts = emergencyService.getPatientEmergencyAlerts(globalPatientId);
      expect(updatedAlerts[0].reviewedByPatient).to.be.true;
    });
  });

  describe("2. Post-Hoc Federation Admin Review Queue", () => {
    let reviewId: string;

    beforeEach(async () => {
      await emergencyService.executeCrossChainEmergencyBreakGlass({
        requestingGateway: gatewayB,
        sourceInstitutionId: instA_Id,
        globalPatientId,
        doctorWallet: doctorMillerWallet.address,
        doctorName: "Dr. Robert Miller, DO",
        clinicalJustification: "Severe head trauma with intracranial hemorrhage; emergency craniotomy.",
        emergencyLevel: "LEVEL_1_TRAUMA",
      });

      const pending = emergencyService.getPendingReviews();
      expect(pending).to.have.lengthOf(1);
      reviewId = pending[0].reviewId;
    });

    it("should enqueue emergency event into admin review queue with PENDING_REVIEW status", () => {
      const allReviews = emergencyService.getAllReviews();
      expect(allReviews).to.have.lengthOf(1);
      expect(allReviews[0].status).to.equal("PENDING_REVIEW");
      expect(allReviews[0].clinicalJustification).to.include("craniotomy");
    });

    it("should allow federation admin to validate clinical justification", () => {
      const updated = emergencyService.reviewEmergencyAccess(
        reviewId,
        "JUSTIFICATION_VALIDATED",
        "Clinical trauma notes confirmed legitimate by federation audit committee.",
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" // Federation Admin
      );

      expect(updated.status).to.equal("JUSTIFICATION_VALIDATED");
      expect(updated.reviewedBy).to.equal("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
      expect(emergencyService.getPendingReviews()).to.have.lengthOf(0);
    });

    it("should allow federation admin to flag improper access for inquiry", () => {
      const updated = emergencyService.reviewEmergencyAccess(
        reviewId,
        "FLAGGED_FOR_INQUIRY",
        "Justification insufficient; patient was documented conscious in admission logs.",
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      );

      expect(updated.status).to.equal("FLAGGED_FOR_INQUIRY");
      expect(updated.adminNotes).to.include("insufficient");
    });
  });
});
