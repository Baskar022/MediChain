import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 20, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many key rotation requests. Please wait." }, { status: 429 })
    );
  }

  try {
    const body = await req.json();
    const { institutionId, newGatewayPublicKey, reason = "Routine Security Key Rotation" } = body;

    if (!institutionId || !newGatewayPublicKey) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "institutionId and newGatewayPublicKey are required." },
          { status: 400 }
        )
      );
    }

    const inst = dbManager.getInstitution(institutionId);
    if (!inst) {
      return applySecurityHeaders(
        NextResponse.json({ error: `Institution '${institutionId}' not found.` }, { status: 404 })
      );
    }

    if (inst.status !== "ACTIVE") {
      return applySecurityHeaders(
        NextResponse.json(
          { error: `Cannot rotate gateway key for institution in '${inst.status}' state.` },
          { status: 403 }
        )
      );
    }

    const oldKey = inst.gateway_public_key;
    dbManager.updateGatewayPublicKey(institutionId, newGatewayPublicKey);

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        institutionId,
        institutionName: inst.name,
        previousPublicKey: oldKey,
        newGatewayPublicKey,
        rotationReason: reason,
        message: "Gateway public key rotated successfully. Short-TTL authorization cache invalidated.",
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to rotate gateway key" }, { status: 500 })
    );
  }
}
