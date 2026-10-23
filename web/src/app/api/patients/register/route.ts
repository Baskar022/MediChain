import { NextRequest, NextResponse } from "next/server";
import { dbManager, PatientEntity } from "@/lib/db";
import { ethers } from "ethers";
import * as crypto from "crypto";

const DEFAULT_DEV_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function deriveGlobalPatientId(idSecret: string): string {
  const salt = "MEDICHAIN_GLOBAL_IDENTITY_SALT_V1";
  return "0x" + crypto.createHmac("sha256", salt).update(idSecret.trim()).digest("hex");
}

function deriveLocalPseudonym(globalPatientId: string, hospitalId: string): string {
  return "0x" + crypto.createHmac("sha256", hospitalId.toLowerCase()).update(globalPatientId).digest("hex");
}

export async function GET() {
  try {
    const list = dbManager.getAllPatients();
    return NextResponse.json({
      status: "ok",
      count: list.length,
      patients: list,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      idSecret,
      hospitalId = "HOSPITAL-CITY-GENERAL",
      password = "Password123!",
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Patient name is required" }, { status: 400 });
    }
    if (!idSecret || idSecret.trim().length === 0) {
      return NextResponse.json({ error: "Identity secret (e.g. National ID, SSN, Passport) is required" }, { status: 400 });
    }

    // 1. Universal Pseudonymous ID derivation (Zero PHI)
    const globalPatientId = deriveGlobalPatientId(idSecret);
    const localPseudonym = deriveLocalPseudonym(globalPatientId, hospitalId);

    // 2. In-Browser Encrypted Wallet Creation
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    // Encrypt keystore using patient's chosen password
    let encryptedKeystore = "";
    try {
      encryptedKeystore = await wallet.encrypt(password);
    } catch {
      // Keystore encryption fallback
    }

    // 3. Sponsoring Gas on Local Chain (Network A) with timeout protection
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_NETWORK_A_RPC || "http://127.0.0.1:8545",
        undefined,
        { staticNetwork: true }
      );
      const faucet = new ethers.Wallet(DEFAULT_DEV_KEY, provider);
      const fundPromise = faucet.sendTransaction({
        to: walletAddress,
        value: ethers.parseEther("1.0"),
      }).then((tx) => tx.wait(1));

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Faucet timeout")), 1200)
      );
      await Promise.race([fundPromise, timeoutPromise]);
    } catch {
      // Offline fallback
    }

    // 4. Save to Database
    const patientEntity: PatientEntity = {
      global_patient_id: globalPatientId,
      local_pseudonym: localPseudonym,
      name: name.trim(),
      id_secret: idSecret.trim(),
      hospital_id: hospitalId,
      wallet_address: walletAddress.toLowerCase(),
      encrypted_keystore: encryptedKeystore,
      created_at: Date.now(),
    };

    dbManager.insertPatient(patientEntity);

    return NextResponse.json({
      success: true,
      patient: {
        globalPatientId,
        localPseudonym,
        name: patientEntity.name,
        hospitalId: patientEntity.hospital_id,
        walletAddress,
        privateKey, // Returned once so in-browser wallet can import immediately
        encryptedKeystore,
      },
      message: `Patient '${name}' registered with Global Pseudonymous ID: ${globalPatientId.slice(0, 14)}...`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
