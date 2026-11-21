import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return applySecurityHeaders(
        NextResponse.json({ error: "patientId parameter required" }, { status: 400 })
      );
    }

    const alerts = dbManager.getPatientAlerts(patientId);

    return applySecurityHeaders(
      NextResponse.json({
        alerts: alerts.map((a) => ({
          ...a,
          metadata: a.metadata_json ? JSON.parse(a.metadata_json) : null,
        })),
        unreadCount: alerts.filter((a) => a.is_read === 0).length,
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to fetch patient alerts" }, { status: 500 })
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { alertId } = body;

    if (!alertId) {
      return applySecurityHeaders(
        NextResponse.json({ error: "alertId parameter required" }, { status: 400 })
      );
    }

    dbManager.markPatientAlertRead(alertId);

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        alertId,
        message: "Alert marked as acknowledged.",
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to acknowledge alert" }, { status: 500 })
    );
  }
}
