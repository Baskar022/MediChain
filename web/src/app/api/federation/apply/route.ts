import { NextRequest, NextResponse } from "next/server";
import { dbManager, InstitutionEntity } from "@/lib/db";
import { ethers } from "ethers";

/**
 * POST /api/federation/apply
 * Submits an application for a new hospital, lab, or clinic to join the consortium.
 * Status is set to APPLIED pending Safe 2-of-3 multisig approval.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      institutionType = "HOSPITAL",
      chainType = "EVM",
      chainId = "11155111",
      rpcPort = 8545,
      licenseNumber,
      documentHash, // IPFS CID of accreditation papers
      gatewayEndpoint,
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Institution legal name is required" }, { status: 400 });
    }
    if (!licenseNumber || licenseNumber.trim().length === 0) {
      return NextResponse.json({ error: "Medical regulatory license number is required" }, { status: 400 });
    }

    // Generate deterministic institution ID
    const institutionId = ethers.keccak256(ethers.toUtf8Bytes(name.trim() + "_" + licenseNumber.trim()));
    const licenseNumberHash = ethers.keccak256(ethers.toUtf8Bytes(licenseNumber.trim()));

    // Generate gateway cryptographic keypair
    const gatewayWallet = ethers.Wallet.createRandom();
    const gatewayPublicKey = gatewayWallet.publicKey;
    const gatewayPrivateKey = gatewayWallet.privateKey;
    const gatewayAddress = gatewayWallet.address;

    const endpoint = gatewayEndpoint || `http://127.0.0.1:${rpcPort}`;

    const newInst: InstitutionEntity = {
      id: institutionId,
      name: name.trim(),
      institution_type: institutionType,
      chain_type: chainType,
      chain_id: chainId.toString(),
      rpc_port: Number(rpcPort),
      gateway_public_key: gatewayPublicKey,
      gateway_private_key: gatewayPrivateKey,
      gateway_endpoint: endpoint,
      status: "APPLIED",
      trust_level: 1, // Default pending trust level
      license_number_hash: licenseNumberHash,
      document_hash: documentHash || `ipfs://QmPendingDocHash_${institutionId.slice(2, 10)}`,
      created_at: Date.now(),
    };

    dbManager.insertInstitution(newInst);

    return NextResponse.json({
      status: "APPLIED",
      message: "Application submitted successfully and enqueued for Safe multisig review.",
      institution: {
        id: institutionId,
        name: newInst.name,
        institutionType: newInst.institution_type,
        chainType: newInst.chain_type,
        chainId: newInst.chain_id,
        gatewayAddress,
        gatewayPublicKey,
        status: newInst.status,
        licenseNumberHash,
        documentHash: newInst.document_hash,
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
