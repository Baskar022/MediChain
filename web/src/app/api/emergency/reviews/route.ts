import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let events = dbManager.getAllEmergencyAccessEvents();

    if (status) {
      events = events.filter((e) => e.review_status.toUpperCase() === status.toUpperCase());
    }

    const reviews = events.map((e) => ({
      reviewId: e.id,
      accessId: e.access_id,
      patientIdHash: e.patient_id_hash,
      doctorName: e.doctor_name,
      doctorWallet: e.doctor_wallet,
      hospitalId: e.hospital_id,
      clinicalJustification: e.justification,
      emergencyLevel: e.emergency_level,
      triggeredAt: e.accessed_at,
      expiresAt: e.expires_at,
      status: e.review_status,
      adminNotes: e.admin_notes,
      reviewedAt: e.reviewed_at,
      reviewedBy: e.reviewed_by,
      emergencyContactPhone: e.emergency_contact_phone,
      criticalSummary: JSON.parse(e.critical_summary_json || "{}"),
    }));

    const pendingCount = reviews.filter((r) => r.status === "PENDING_REVIEW").length;
    const validatedCount = reviews.filter((r) => r.status === "JUSTIFICATION_VALIDATED").length;
    const flaggedCount = reviews.filter((r) => r.status === "FLAGGED_FOR_INQUIRY").length;

    return applySecurityHeaders(
      NextResponse.json({
        reviews,
        total: reviews.length,
        stats: {
          pendingCount,
          validatedCount,
          flaggedCount,
        },
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to fetch review queue" }, { status: 500 })
    );
  }
}

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 40, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many review requests. Please slow down." }, { status: 429 })
    );
  }

  try {
    const body = await req.json();
    const { reviewId, status, adminNotes = "", reviewerWallet = "0xadmin_consortium" } = body;

    if (!reviewId || !status) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Missing required fields: reviewId, status" }, { status: 400 })
      );
    }

    const validStatuses = ["JUSTIFICATION_VALIDATED", "FLAGGED_FOR_INQUIRY", "PENDING_REVIEW"];
    if (!validStatuses.includes(status)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: `Invalid status: must be one of ${validStatuses.join(", ")}` },
          { status: 400 }
        )
      );
    }

    const event = dbManager.getEmergencyAccessById(reviewId);
    if (!event) {
      return applySecurityHeaders(
        NextResponse.json({ error: `Emergency event with ID '${reviewId}' not found.` }, { status: 404 })
      );
    }

    dbManager.updateEmergencyReview(reviewId, status, adminNotes, reviewerWallet);

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        reviewId,
        previousStatus: event.review_status,
        newStatus: status,
        reviewedBy: reviewerWallet,
        adminNotes,
        message: `Emergency access event has been marked as '${status}'.`,
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to submit review decision" }, { status: 500 })
    );
  }
}
