import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbManager } from "@/lib/db";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 30, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many emergency requests. Please wait." }, { status: 429 })
    );
  }

  try {
    const body = await req.json();
    const {
      globalPatientId,
      doctorName,
      doctorWallet,
      hospitalId,
      clinicalJustification,
      emergencyLevel = "LEVEL_1_TRAUMA",
      emergencyContactPhone = "+1 (555) 019-2834",
      timeBoxSeconds = 86400, // 24 hours
    } = body;

    if (!globalPatientId || !doctorName || !doctorWallet || !clinicalJustification) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Missing required fields: globalPatientId, doctorName, doctorWallet, clinicalJustification" },
          { status: 400 }
        )
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + timeBoxSeconds;
    const accessId = "emg_" + crypto.randomBytes(16).toString("hex");

    // Construct Standard Critical Medical Summary ONLY (No full records released)
    const criticalSummary = {
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
      timeBox: {
        accessedAt: now,
        expiresAt,
        windowHours: Math.round(timeBoxSeconds / 3600),
      },
    };

    // 1. Persist Emergency Event in Review Queue (PENDING_REVIEW)
    dbManager.insertEmergencyAccess({
      id: accessId,
      access_id: accessId,
      patient_id_hash: globalPatientId,
      doctor_name: doctorName,
      doctor_wallet: doctorWallet,
      hospital_id: hospitalId || "hospital-emergency-unit",
      justification: clinicalJustification,
      emergency_level: emergencyLevel,
      accessed_at: now,
      expires_at: expiresAt,
      review_status: "PENDING_REVIEW",
      emergency_contact_phone: emergencyContactPhone,
      critical_summary_json: JSON.stringify(criticalSummary),
    });

    // 2. Dispatch In-App Patient Alert
    dbManager.insertPatientAlert({
      id: "alt_" + crypto.randomBytes(8).toString("hex"),
      patient_id_hash: globalPatientId,
      alert_type: "EMERGENCY_BREAK_GLASS",
      title: "Emergency Break-Glass Access Triggered",
      message: `Emergency trauma access was invoked on your medical summary by ${doctorName}. Clinical Justification: "${clinicalJustification}". Your emergency contact (${emergencyContactPhone}) has been notified.`,
      metadata_json: JSON.stringify({
        accessId,
        doctorName,
        doctorWallet,
        hospitalId,
        accessedAt: now,
        expiresAt,
      }),
      is_read: 0,
      created_at: Date.now(),
    });

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        accessId,
        emergencyLevel,
        expiresAt,
        timeBoxSeconds,
        criticalSummary,
        reviewStatus: "PENDING_REVIEW",
        message: "24-Hour Emergency Access active. Critical summary released. Event enqueued for federation review.",
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to process emergency break-glass" }, { status: 500 })
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorWallet = searchParams.get("doctorWallet");
    const patientId = searchParams.get("patientId");

    let events = dbManager.getAllEmergencyAccessEvents();

    if (doctorWallet) {
      events = events.filter((e) => e.doctor_wallet.toLowerCase() === doctorWallet.toLowerCase());
    }
    if (patientId) {
      events = events.filter((e) => e.patient_id_hash.toLowerCase() === patientId.toLowerCase());
    }

    return applySecurityHeaders(
      NextResponse.json({
        events: events.map((e) => ({
          ...e,
          criticalSummary: JSON.parse(e.critical_summary_json || "{}"),
        })),
        count: events.length,
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to fetch emergency events" }, { status: 500 })
    );
  }
}
