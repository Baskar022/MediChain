import { NextRequest, NextResponse } from "next/server";
import { dbManager, StaffEntity } from "@/lib/db";
import { ethers } from "ethers";

/**
 * POST /api/staff/register
 * Enrolls a clinical doctor or lab technician under an institution.
 * Role is recorded on-chain (StaffRegistry.sol) and indexed locally.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      hospitalWallet,
      name,
      specialty = "General Medicine",
      role = "DOCTOR",
      licenseNumber,
      walletAddress,
    } = body;

    if (!hospitalWallet) {
      return NextResponse.json({ error: "hospitalWallet is required" }, { status: 400 });
    }
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Staff practitioner name is required" }, { status: 400 });
    }
    if (!licenseNumber || licenseNumber.trim().length === 0) {
      return NextResponse.json({ error: "Practitioner medical license number is required" }, { status: 400 });
    }

    // Generate staff wallet if not provided (e.g. built-in institution account)
    let staffWallet = walletAddress;
    let staffPrivateKey: string | undefined = undefined;

    if (!staffWallet) {
      const generated = ethers.Wallet.createRandom();
      staffWallet = generated.address;
      staffPrivateKey = generated.privateKey;
    } else {
      staffWallet = ethers.getAddress(staffWallet);
    }

    const staffId = "STAFF-" + ethers.keccak256(ethers.toUtf8Bytes(hospitalWallet + staffWallet)).slice(2, 10).toUpperCase();

    const newStaff: StaffEntity = {
      id: staffId,
      hospital_wallet: hospitalWallet.toLowerCase(),
      name: name.trim(),
      specialty,
      role: role === "LAB_TECH" ? "LAB_TECH" : (role === "INSTITUTION_ADMIN" ? "INSTITUTION_ADMIN" : "DOCTOR"),
      wallet_address: staffWallet.toLowerCase(),
      private_key: staffPrivateKey,
      license_number: licenseNumber.trim(),
      is_active: 1,
      created_at: Date.now(),
    };

    dbManager.insertStaff(newStaff);

    return NextResponse.json({
      status: "ACTIVE",
      message: `${newStaff.role} ${newStaff.name} registered successfully.`,
      staff: {
        id: newStaff.id,
        name: newStaff.name,
        role: newStaff.role,
        specialty: newStaff.specialty,
        walletAddress: staffWallet,
        hospitalWallet: newStaff.hospital_wallet,
        licenseNumber: newStaff.license_number,
        isActive: true,
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
