import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";

/**
 * POST /api/federation/remove
 * Permanently expels an institution from the federation directory.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { institutionId, reason = "Revocation of operating accreditation" } = body;

    if (!institutionId) {
      return NextResponse.json({ error: "institutionId is required" }, { status: 400 });
    }

    const inst = dbManager.getInstitution(institutionId);
    if (!inst) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    dbManager.updateInstitutionStatus(institutionId, "REMOVED", reason);

    return NextResponse.json({
      status: "REMOVED",
      message: `Institution ${inst.name} permanently removed from consortium.`,
      institutionId,
      reason,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
