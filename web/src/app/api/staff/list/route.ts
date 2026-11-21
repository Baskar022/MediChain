import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";

/**
 * GET /api/staff/list?hospitalWallet=0x...
 * Lists staff practitioners for an institution or all staff across institutions.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hospitalWallet = searchParams.get("hospitalWallet");

    const staffList = hospitalWallet
      ? dbManager.getStaffByHospital(hospitalWallet)
      : dbManager.getAllStaff();

    return NextResponse.json({
      status: "ok",
      count: staffList.length,
      staff: staffList.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        specialty: s.specialty,
        walletAddress: s.wallet_address,
        hospitalWallet: s.hospital_wallet,
        licenseNumber: s.license_number,
        isActive: s.is_active === 1,
        revocationReason: s.revocation_reason,
        createdAt: s.created_at,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
