import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";

/**
 * POST /api/federation/suspend
 * Suspends an active institution due to compliance review or compromised gateway keys.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { institutionId, reason = "Compliance investigation" } = body;

    if (!institutionId) {
      return NextResponse.json({ error: "institutionId is required" }, { status: 400 });
    }

    const inst = dbManager.getInstitution(institutionId);
    if (!inst) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    dbManager.updateInstitutionStatus(institutionId, "SUSPENDED", reason);

    return NextResponse.json({
      status: "SUSPENDED",
      message: `Institution ${inst.name} has been suspended. Gateways will reject communication.`,
      institutionId,
      reason,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
