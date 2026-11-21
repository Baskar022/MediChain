import { NextResponse } from "next/server";
import { dbManager } from "@/lib/db";

/**
 * GET /api/federation/review-queue
 * Retrieves pending institution applications awaiting Safe multisig committee review.
 */
export async function GET() {
  try {
    const pending = dbManager.getPendingInstitutions();
    const all = dbManager.getAllInstitutions();

    return NextResponse.json({
      status: "ok",
      pendingCount: pending.length,
      pendingApplications: pending.map((inst) => ({
        id: inst.id,
        name: inst.name,
        institutionType: inst.institution_type,
        chainType: inst.chain_type,
        chainId: inst.chain_id,
        gatewayEndpoint: inst.gateway_endpoint,
        gatewayPublicKey: inst.gateway_public_key,
        licenseNumberHash: inst.license_number_hash,
        documentHash: inst.document_hash,
        appliedAt: inst.created_at,
        status: inst.status,
      })),
      recentDecisions: all
        .filter((i) => i.status !== "APPLIED")
        .slice(-5)
        .map((inst) => ({
          id: inst.id,
          name: inst.name,
          status: inst.status,
          trustLevel: inst.trust_level,
          rejectionReason: inst.rejection_reason,
        })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
