import { NextRequest, NextResponse } from "next/server";
import { dbManager, StaffEntity } from "@/lib/db";
import { ethers } from "ethers";

const DEFAULT_DEV_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hospital = searchParams.get("hospital");

    const staff = hospital
      ? dbManager.getStaffByHospital(hospital)
      : dbManager.getAllStaff();

    return NextResponse.json({
      status: "ok",
      count: staff.length,
      staff,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      hospitalWallet = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      name,
      specialty = "General Medicine",
      role = "DOCTOR",
      walletAddress: customAddress,
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Staff name is required" }, { status: 400 });
    }

    let walletAddress = customAddress;
    let privateKey: string | undefined = undefined;

    // If no wallet address provided, generate a dedicated one
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      const generated = ethers.Wallet.createRandom();
      walletAddress = generated.address;
      privateKey = generated.privateKey;
    }

    // Attempt to fund/sponsor the new doctor wallet on Network A (port 8545) with 1 ETH
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_NETWORK_A_RPC || "http://127.0.0.1:8545");
      const faucet = new ethers.Wallet(DEFAULT_DEV_KEY, provider);
      const tx = await faucet.sendTransaction({
        to: walletAddress,
        value: ethers.parseEther("1.0"),
      });
      await tx.wait(1);
    } catch {
      // Ignore if local node is offline during offline testing
    }

    const id = "staff_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const staffEntity: StaffEntity = {
      id,
      hospital_wallet: hospitalWallet.toLowerCase(),
      name: name.trim(),
      specialty: specialty.trim(),
      role,
      wallet_address: walletAddress.toLowerCase(),
      private_key: privateKey,
      is_active: 1,
      created_at: Date.now(),
    };

    dbManager.insertStaff(staffEntity);

    return NextResponse.json({
      success: true,
      staff: staffEntity,
      message: `Doctor ${name} registered successfully with sponsored wallet.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
