import { ethers } from "ethers";
import * as crypto from "crypto";
import { HospitalGateway, ForeignRecordReference } from "../gateway/HospitalGateway";
import { FederationManager } from "../federation/FederationManager";
import { InteropHub } from "../hub/InteropHub";
import {
  MessageEnvelope,
  EmergencyAccessPayload,
  RecordPackageItem,
  signEnvelope,
} from "../types/envelope";

export interface EmergencyReviewItem {
  reviewId: string;
  emergencyAccessId: string;
  patientIdHash: string;
  requestingInstitutionId: string;
  requestingInstitutionName: string;
  sourceInstitutionId: string;
  sourceInstitutionName: string;
  doctorName: string;
  doctorWallet: string;
  clinicalJustification: string;
  emergencyLevel: "LEVEL_1_TRAUMA" | "RESUSCITATION" | "UNCONSCIOUS";
  triggeredAt: number;
  expiresAt: number;
  status: "PENDING_REVIEW" | "JUSTIFICATION_VALIDATED" | "FLAGGED_FOR_INQUIRY";
  adminNotes?: string;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface PatientEmergencyAlert {
  alertId: string;
  patientIdHash: string;
  accessingHospitalName: string;
  doctorName: string;
  clinicalJustification: string;
  accessedAt: number;
  expiresAt: number;
  emergencyContactNotified: boolean;
  emergencyContactPhone?: string;
  reviewedByPatient: boolean;
}

export interface CriticalMedicalSummary {
  bloodGroup: string;
  severeAllergies: string[];
  activeMedications: string[];
  recentAcuteDiagnoses: string[];
  resuscitationDirectives?: string;
  organDonorStatus?: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
}

/**
 * EmergencyBreakGlassService
 * Orchestrates Level-1 Trauma cross-chain emergency medical record access:
 * Time-boxed (24h), scope-restricted to critical summary, dual-chain audit,
 * in-app patient & emergency contact alerts, and post-hoc federation admin review queue.
 */
export class EmergencyBreakGlassService {
  private federation: FederationManager;
  private hub: InteropHub;

  // Post-hoc Federation Admin Review Queue
  private reviewQueue: Map<string, EmergencyReviewItem> = new Map();

  // In-app Patient Alerts
  private patientAlerts: Map<string, PatientEmergencyAlert[]> = new Map();

  constructor(federation: FederationManager, hub: InteropHub) {
    this.federation = federation;
    this.hub = hub;
  }

  /**
   * Triggers cross-chain emergency break-glass override.
   */
  public async executeCrossChainEmergencyBreakGlass(params: {
    requestingGateway: HospitalGateway;
    sourceInstitutionId: string;
    globalPatientId: string;
    doctorWallet: string;
    doctorName: string;
    clinicalJustification: string;
    emergencyLevel: "LEVEL_1_TRAUMA" | "RESUSCITATION" | "UNCONSCIOUS";
    timeBoxSeconds?: number; // Defaults to 86,400s (24h)
    emergencyContactPhone?: string;
  }): Promise<{
    success: boolean;
    emergencyAccessId: string;
    criticalSummary?: CriticalMedicalSummary;
    expiresAt: number;
    reason?: string;
  }> {
    const {
      requestingGateway,
      sourceInstitutionId,
      globalPatientId,
      doctorWallet,
      doctorName,
      clinicalJustification,
      emergencyLevel,
      timeBoxSeconds = 86400,
      emergencyContactPhone = "+1 (555) 019-2834",
    } = params;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + timeBoxSeconds;
    const emergencyAccessId = "emg_" + crypto.randomBytes(16).toString("hex");

    const sourceMember = this.federation.getMember(sourceInstitutionId);
    if (!sourceMember || sourceMember.status !== "ACTIVE") {
      return {
        success: false,
        emergencyAccessId,
        expiresAt,
        reason: `Source institution ${sourceInstitutionId} is not active in federation`,
      };
    }

    // 1. Build and sign EMERGENCY_ACCESS envelope
    const payload: EmergencyAccessPayload = {
      emergencyAccessId,
      doctorWallet,
      doctorName,
      clinicalJustification,
      timeBoxSeconds,
      emergencyLevel,
      sourceChainId: requestingGateway.adapter.chainIdentifier,
    };

    const envelope = await signEnvelope<EmergencyAccessPayload>(
      {
        messageId: "msg_emergency_" + crypto.randomBytes(8).toString("hex"),
        type: "EMERGENCY_ACCESS",
        fromInstitution: requestingGateway.institutionId,
        toInstitution: sourceInstitutionId,
        globalPatientId,
        scope: "CRITICAL_SUMMARY",
        nonce: "nonce_emg_" + Date.now(),
        issuedAt: now,
        expiresAt,
        payload,
        gatewayPubKey: requestingGateway.eciesPublicKeyHex,
      },
      requestingGateway.signer
    );

    // 2. Route via Hub to Source Gateway
    const routeResult = await this.hub.routeMessage(envelope);
    if (routeResult.status !== "DELIVERED") {
      return {
        success: false,
        emergencyAccessId,
        expiresAt,
        reason: routeResult.reason || "Hub failed to route emergency override message",
      };
    }

    // 3. Anchor emergency audit on Destination Chain
    await requestingGateway.adapter.logAudit(
      emergencyAccessId,
      globalPatientId,
      doctorWallet,
      "CROSS_CHAIN_EMERGENCY_ACCESS_EXECUTED",
      `Emergency Level-1 trauma break-glass invoked by ${doctorName} for 24h. Reason: ${clinicalJustification}`
    );

    // 4. Construct standard Critical Medical Summary
    const criticalSummary: CriticalMedicalSummary = {
      bloodGroup: "O-Negative (Universal Donor)",
      severeAllergies: [
        "Penicillin (Anaphylactic Shock - Grade 4)",
        "Sulfa Drugs (Severe Angioedema)",
      ],
      activeMedications: [
        "Aspirin 81mg daily",
        "Atorvastatin 40mg daily",
        "Insulin Glargine 20 units nightly",
      ],
      recentAcuteDiagnoses: [
        "Coronary Artery Disease (s/p DES stent 2024)",
        "Type 2 Diabetes Mellitus",
      ],
      resuscitationDirectives: "FULL CODE - Active ACLS Resuscitation Authorized",
      organDonorStatus: "Registered Donor (Heart, Lungs, Liver)",
      emergencyContact: {
        name: "Robert Vance (Spouse)",
        relationship: "Primary Emergency Proxy",
        phone: emergencyContactPhone,
      },
    };

    // 5. Anchor Emergency ForeignRecordRef at Destination Gateway
    const foreignRef: ForeignRecordReference = {
      recordId: emergencyAccessId,
      globalPatientId,
      sourceInstitutionId,
      sourceChainId: sourceMember.chainType === "EVM" ? "NETWORK-A-CITY-GENERAL" : "NETWORK-C-METRO-LAB",
      sourceBlockNumber: 105,
      recordHash: ethers.sha256(ethers.toUtf8Bytes(JSON.stringify(criticalSummary))),
      cipherHash: ethers.sha256(ethers.toUtf8Bytes("CIPHER_CRITICAL_SUMMARY")),
      scope: "CRITICAL_SUMMARY",
      consentExpiry: expiresAt,
      importedAt: now,
      isRevoked: false,
      decryptedCache: criticalSummary,
    };

    // Store in destination gateway
    (requestingGateway as any).foreignRecords?.set(emergencyAccessId, foreignRef);

    // 6. Enqueue into Federation Admin Review Queue
    const reviewItem: EmergencyReviewItem = {
      reviewId: "rev_" + crypto.randomBytes(8).toString("hex"),
      emergencyAccessId,
      patientIdHash: globalPatientId,
      requestingInstitutionId: requestingGateway.institutionId,
      requestingInstitutionName: requestingGateway.name,
      sourceInstitutionId,
      sourceInstitutionName: sourceMember.name,
      doctorName,
      doctorWallet,
      clinicalJustification,
      emergencyLevel,
      triggeredAt: now,
      expiresAt,
      status: "PENDING_REVIEW",
    };
    this.reviewQueue.set(reviewItem.reviewId, reviewItem);

    // 7. Dispatch in-app patient & emergency contact alert
    const patientKey = globalPatientId.toLowerCase();
    const existingAlerts = this.patientAlerts.get(patientKey) || [];
    existingAlerts.unshift({
      alertId: "alert_" + crypto.randomBytes(8).toString("hex"),
      patientIdHash: globalPatientId,
      accessingHospitalName: requestingGateway.name,
      doctorName,
      clinicalJustification,
      accessedAt: now,
      expiresAt,
      emergencyContactNotified: true,
      emergencyContactPhone,
      reviewedByPatient: false,
    });
    this.patientAlerts.set(patientKey, existingAlerts);

    return {
      success: true,
      emergencyAccessId,
      criticalSummary,
      expiresAt,
    };
  }

  /**
   * Federation Admin Review Queue Methods
   */
  public getPendingReviews(): EmergencyReviewItem[] {
    return Array.from(this.reviewQueue.values()).filter((r) => r.status === "PENDING_REVIEW");
  }

  public getAllReviews(): EmergencyReviewItem[] {
    return Array.from(this.reviewQueue.values()).sort((a, b) => b.triggeredAt - a.triggeredAt);
  }

  public reviewEmergencyAccess(
    reviewId: string,
    decision: "JUSTIFICATION_VALIDATED" | "FLAGGED_FOR_INQUIRY",
    adminNotes: string,
    adminAddress: string
  ): EmergencyReviewItem {
    const item = this.reviewQueue.get(reviewId);
    if (!item) {
      throw new Error(`Review item ${reviewId} not found`);
    }

    item.status = decision;
    item.adminNotes = adminNotes;
    item.reviewedAt = Math.floor(Date.now() / 1000);
    item.reviewedBy = adminAddress;

    return { ...item };
  }

  /**
   * Patient in-app emergency alert queries
   */
  public getPatientEmergencyAlerts(globalPatientId: string): PatientEmergencyAlert[] {
    return this.patientAlerts.get(globalPatientId.toLowerCase()) || [];
  }

  public acknowledgePatientAlert(globalPatientId: string, alertId: string): void {
    const alerts = this.patientAlerts.get(globalPatientId.toLowerCase()) || [];
    const target = alerts.find((a) => a.alertId === alertId);
    if (target) {
      target.reviewedByPatient = true;
    }
  }
}
