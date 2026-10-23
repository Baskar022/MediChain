import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { dbManager } from "@/lib/db";
import { computeSha256 } from "@/lib/crypto/hash";
import { authenticateRequest, rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed } = rateLimit(req, 60, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
  }

  const recordId = params.id;
  const record = dbManager.getRecord(recordId);

  if (!record) {
    return applySecurityHeaders(
      NextResponse.json({ error: `Record ${recordId} not found` }, { status: 404 })
    );
  }

  // Resolve storage file
  const fullPath = path.isAbsolute(record.storage_path)
    ? record.storage_path
    : path.join(dbManager.storageDir, path.basename(record.storage_path));

  if (!fs.existsSync(fullPath)) {
    return applySecurityHeaders(
      NextResponse.json({ error: `Storage payload file for record ${recordId} is missing` }, { status: 404 })
    );
  }

  const fileContent = fs.readFileSync(fullPath, "utf-8");
  let encryptedPayload: { ciphertext: string; iv: string };
  try {
    encryptedPayload = JSON.parse(fileContent);
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "Corrupted storage file structure" }, { status: 500 })
    );
  }

  // Calculate live hash of the stored ciphertext
  const currentCipherHash = computeSha256(encryptedPayload.ciphertext);
  const isTampered = currentCipherHash.toLowerCase() !== record.cipher_hash.toLowerCase();

  // Find wrapped key for requesting user or query param
  const { searchParams } = new URL(req.url);
  const requestedWallet = searchParams.get("recipient") || req.headers.get("x-wallet-address") || "";
  let wrappedKey: string | undefined = undefined;

  if (requestedWallet) {
    wrappedKey = dbManager.getWrappedKey(recordId, requestedWallet);
  }

  // Also include all wrapped keys if caller is the issuer or patient owner
  const allKeys = dbManager.getWrappedKeysByRecord(recordId);

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      record,
      encryptedPayload,
      wrappedKey,
      availableRecipients: allKeys.map((k) => k.recipient_wallet),
      isTampered,
      currentCipherHash,
      originalCipherHash: record.cipher_hash,
    })
  );
}
