import { expect } from "chai";
import { ethers } from "ethers";
import crypto from "crypto";
import { dbManager } from "../../db";
import { deriveGlobalPatientId } from "../../../../../interop/types/identity";

describe("Phase F-6: Emergency Break-Glass Override & Federation Admin Review Queue", () => {
  const patientSecret = "SYNTHETIC-PATIENT-EMERGENCY-TEST";
  const globalPatientId = deriveGlobalPatientId(patientSecret);
  const doctorWallet = ethers.Wallet.createRandom();
  const hospitalId = "hospital-trauma-center-01";

  before(() => {
    // Clear test database tables
    dbManager.clearAllData();
  });

  describe("1. Emergency Break-Glass Execution & Time-Boxing", () => {
    const accessId = "emg_test_" + crypto.randomBytes(8).toString("hex");
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 86400; // Strictly 24 hours

    const criticalSummary = {
      bloodGroup: "O-Negative (Universal Donor)",
      severeAllergies: ["Penicillin (Anaphylactic Shock - Grade 4)", "Sulfa Drugs (Severe Angioedema)"],
      activeMedications: ["Aspirin 81mg daily", "Atorvastatin 40mg daily"],
      recentAcuteDiagnoses: ["Acute Coronary Syndrome", "Type 2 Diabetes"],
      resuscitationDirectives: "FULL CODE - Active ACLS Resuscitation Authorized",
      emergencyContact: {
        name: "Robert Vance",
        relationship: "Spouse",
        phone: "+1-555-0199",
      },
    };

    it("should trigger emergency break-glass and persist with PENDING_REVIEW status", () => {
      dbManager.insertEmergencyAccess({
        id: accessId,
        access_id: accessId,
        patient_id_hash: globalPatientId,
        doctor_name: "Dr. Sarah Chen, MD",
        doctor_wallet: doctorWallet.address,
        hospital_id: hospitalId,
        justification: "Acute polytrauma with GCS < 8; unconscious patient requiring emergency surgical intervention.",
        emergency_level: "LEVEL_1_TRAUMA",
        accessed_at: now,
        expires_at: expiresAt,
        review_status: "PENDING_REVIEW",
        emergency_contact_phone: "+1-555-0199",
        critical_summary_json: JSON.stringify(criticalSummary),
      });

      const event = dbManager.getEmergencyAccessById(accessId);
      expect(event).to.exist;
      expect(event?.review_status).to.equal("PENDING_REVIEW");
      expect(event?.emergency_level).to.equal("LEVEL_1_TRAUMA");
      expect(event!.expires_at - event!.accessed_at).to.equal(86400);

      // Verify scoped data contains ONLY critical summary
      const parsedSummary = JSON.parse(event?.critical_summary_json!);
      expect(parsedSummary.bloodGroup).to.equal("O-Negative (Universal Donor)");
      expect(parsedSummary.severeAllergies).to.include("Penicillin (Anaphylactic Shock - Grade 4)");
      expect(parsedSummary).to.not.have.property("fullClinicalHistory");
    });

    it("should dispatch in-app alert for patient with emergency contact notification flag", () => {
      const alertId = "alt_test_" + crypto.randomBytes(8).toString("hex");

      dbManager.insertPatientAlert({
        id: alertId,
        patient_id_hash: globalPatientId,
        alert_type: "EMERGENCY_BREAK_GLASS",
        title: "Emergency Break-Glass Access Triggered",
        message: "Dr. Sarah Chen triggered Level-1 trauma break-glass. Emergency contact (+1-555-0199) notified.",
        metadata_json: JSON.stringify({ accessId, doctorWallet: doctorWallet.address }),
        is_read: 0,
        created_at: Date.now(),
      });

      const alerts = dbManager.getPatientAlerts(globalPatientId);
      expect(alerts).to.have.lengthOf(1);
      expect(alerts[0].is_read).to.equal(0);
      expect(alerts[0].title).to.include("Emergency Break-Glass Access Triggered");

      // Patient acknowledges alert
      dbManager.markPatientAlertRead(alertId);
      const updatedAlerts = dbManager.getPatientAlerts(globalPatientId);
      expect(updatedAlerts[0].is_read).to.equal(1);
    });
  });

  describe("2. Federation Admin Review Queue Lifecycle", () => {
    it("should allow federation compliance admin to validate legitimate clinical justification", () => {
      const allEvents = dbManager.getAllEmergencyAccessEvents();
      expect(allEvents.length).to.be.greaterThan(0);

      const target = allEvents[0];
      expect(target.review_status).to.equal("PENDING_REVIEW");

      // Admin validates justification
      dbManager.updateEmergencyReview(
        target.id,
        "JUSTIFICATION_VALIDATED",
        "Consortium CMO: Confirmed valid trauma registry protocol criteria.",
        "0xConsortiumComplianceAdmin"
      );

      const updated = dbManager.getEmergencyAccessById(target.id);
      expect(updated?.review_status).to.equal("JUSTIFICATION_VALIDATED");
      expect(updated?.admin_notes).to.include("Confirmed valid trauma registry");
      expect(updated?.reviewed_by?.toLowerCase()).to.equal("0xconsortiumcomplianceadmin".toLowerCase());
    });

    it("should allow federation compliance admin to flag suspicious break-glass for formal inquiry", () => {
      const suspiciousId = "emg_suspicious_" + crypto.randomBytes(8).toString("hex");
      const now = Math.floor(Date.now() / 1000);

      dbManager.insertEmergencyAccess({
        id: suspiciousId,
        access_id: suspiciousId,
        patient_id_hash: globalPatientId,
        doctor_name: "Dr. Rogue Practitioner",
        doctor_wallet: ethers.Wallet.createRandom().address,
        hospital_id: "clinic-unauthorized",
        justification: "Curiosity check on VIP patient.",
        emergency_level: "UNCONSCIOUS",
        accessed_at: now,
        expires_at: now + 86400,
        review_status: "PENDING_REVIEW",
        critical_summary_json: JSON.stringify({ bloodGroup: "A+" }),
      });

      // Admin flags for inquiry
      dbManager.updateEmergencyReview(
        suspiciousId,
        "FLAGGED_FOR_INQUIRY",
        "Suspicious access: Justification violates Level-1 Trauma threshold. Referring to ethics board.",
        "0xConsortiumComplianceAdmin"
      );

      const flagged = dbManager.getEmergencyAccessById(suspiciousId);
      expect(flagged?.review_status).to.equal("FLAGGED_FOR_INQUIRY");
      expect(flagged?.admin_notes).to.include("violates Level-1 Trauma threshold");
    });
  });
});
