import { NextRequest, NextResponse } from "next/server";
import { dbManager, InstitutionEntity } from "@/lib/db";
import { ethers } from "ethers";

export async function GET() {
  try {
    const list = dbManager.getAllInstitutions();
    return NextResponse.json({
      status: "ok",
      count: list.length,
      institutions: list,
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
      institutionType = "HOSPITAL",
      chainType = "EVM",
      chainId = "31339",
      rpcPort = 8548,
      trustLevel = 3,
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Institution name is required" }, { status: 400 });
    }

    // Generate unique institution ID
    const institutionId = ethers.keccak256(ethers.toUtf8Bytes(name.trim() + "_" + Date.now()));

    // Automatically generate Gateway Keypair
    const gatewayWallet = ethers.Wallet.createRandom();
    const gatewayPublicKey = gatewayWallet.publicKey;
    const gatewayPrivateKey = gatewayWallet.privateKey;
    const gatewayAddress = gatewayWallet.address;

    const gatewayEndpoint = chainType === "EVM"
      ? `http://127.0.0.1:${rpcPort}`
      : `http://127.0.0.1:${rpcPort}`;

    const newInst: InstitutionEntity = {
      id: institutionId,
      name: name.trim(),
      institution_type: institutionType,
      chain_type: chainType,
      chain_id: chainId.toString(),
      rpc_port: Number(rpcPort),
      gateway_public_key: gatewayPublicKey,
      gateway_private_key: gatewayPrivateKey,
      gateway_endpoint: gatewayEndpoint,
      status: "ACTIVE",
      trust_level: Number(trustLevel),
      created_at: Date.now(),
    };

    dbManager.insertInstitution(newInst);

    return NextResponse.json({
      success: true,
      institution: {
        ...newInst,
        gatewayAddress,
      },
      message: `Institution '${name}' onboarded successfully with auto-generated gateway keypair.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;
    if (!id || !["ACTIVE", "SUSPENDED", "REVOKED"].includes(status)) {
      return NextResponse.json({ error: "Valid id and status required" }, { status: 400 });
    }
    dbManager.updateInstitutionStatus(id, status);
    return NextResponse.json({ success: true, id, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
