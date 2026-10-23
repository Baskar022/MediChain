import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { authenticateRequest, rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed } = rateLimit(req, 30, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return applySecurityHeaders(
        NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 })
      );
    }
  }

  const recordId = params.id;
  const record = dbManager.getRecord(recordId);

  if (!record) {
    return applySecurityHeaders(
      NextResponse.json({ error: `Record ${recordId} not found` }, { status: 404 })
    );
  }

  // Check if record is revoked
  if (record.is_revoked) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: `Cannot share record: Record ${recordId} has been revoked by issuing authority.` },
        { status: 403 }
      )
    );
  }

  try {
    const body = await req.json();
    const { recipientWallet, wrappedKey, forceUpdate } = body;

    if (!recipientWallet || !wrappedKey) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "recipientWallet and wrappedKey are required" },
          { status: 400 }
        )
      );
    }

    // Validate recipient address / public key format
    const cleanedRecipient = recipientWallet.trim().toLowerCase();
    if (!cleanedRecipient.startsWith("0x") || (cleanedRecipient.length !== 42 && cleanedRecipient.length < 66)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid recipient key: recipientWallet must be a valid 0x-prefixed hex address or public key." },
          { status: 400 }
        )
      );
    }

    // Check if recipient institution is suspended
    const institutions = dbManager.getAllInstitutions();
    const targetInst = institutions.find(
      (inst) =>
        inst.id.toLowerCase() === cleanedRecipient ||
        inst.gateway_public_key.toLowerCase() === cleanedRecipient
    );
    if (targetInst && (targetInst.status === "SUSPENDED" || targetInst.status === "REVOKED")) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: `Cannot share record: Recipient institution '${targetInst.name}' is currently ${targetInst.status}.` },
          { status: 403 }
        )
      );
    }

    // Prevent duplicate share (same record shared twice)
    const existingKey = dbManager.getWrappedKey(recordId, cleanedRecipient);
    if (existingKey && !forceUpdate) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: `Duplicate share rejected: Record '${recordId}' has already been shared with recipient ${cleanedRecipient}.` },
          { status: 409 }
        )
      );
    }

    dbManager.insertWrappedKey(recordId, cleanedRecipient, wrappedKey);

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        recordId,
        recipientWallet: recipientWallet.toLowerCase(),
        message: "Key successfully wrapped and shared for recipient hospital",
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to share wrapped key" }, { status: 500 })
    );
  }
}
