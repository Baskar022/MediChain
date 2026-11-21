import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";

/**
 * POST /api/staff/revoke
 * Instantly revokes medical staff privileges.
 * Access is invalidated on-chain and in API memory.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, reason = "Privileges revoked by institution administrator" } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const staff = dbManager.getStaffByWallet(walletAddress);
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    dbManager.revokeStaff(walletAddress, reason);

    return NextResponse.json({
      status: "REVOKED",
      message: `Staff member ${staff.name} (${staff.role}) has been instantly revoked. All medical record access revoked.`,
      walletAddress,
      reason,
      revokedAt: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
