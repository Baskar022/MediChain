import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { dbManager } from "@/lib/db";
import { computeSha256 } from "@/lib/crypto/hash";
import { authenticateRequest, rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 40, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many upload requests. Rate limit exceeded." }, { status: 429 })
    );
  }

  // Check JWT session if Authorization header is provided
  const authHeader = req.headers.get("authorization");
  let authenticatedUser: any = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return applySecurityHeaders(
        NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 })
      );
    }
    authenticatedUser = auth.user;
  }

  try {
    const body = await req.json();
    const {
      recordId,
      patientPseudonym,
      recordType,
      recordHash,
      cipherHash,
      ciphertext,
      iv,
      issuerHospital,
      issuerDoctor,
      issuerSignature,
      wrappedKeys,
      fileName,
      mimeType,
      fileSize,
      version,
      previousRecordId,
    } = body;

    // If no JWT Bearer token, require cryptographic doctor signature or issuer identity
    if (!authenticatedUser && (!issuerDoctor && !issuerSignature)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Authentication required: provide valid Bearer session token or doctor cryptographic signature." },
          { status: 401 }
        )
      );
    }

    // Check role permissions: Patients cannot anchor clinical records
    if (authenticatedUser && authenticatedUser.role === "PATIENT") {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Access Denied: Patients cannot anchor medical records. Only authorized physicians or hospital staff can upload records." },
          { status: 403 }
        )
      );
    }

    if (!recordId || !patientPseudonym || !recordHash || !cipherHash || !ciphertext || !iv) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Missing required record parameters (recordId, patientPseudonym, hashes, ciphertext, iv)" },
          { status: 400 }
        )
      );
    }

    // 0. Validate institutional federation status
    const effectiveHospital = (issuerHospital || authenticatedUser?.hospitalWallet || authenticatedUser?.walletAddress || "").toLowerCase();
    if (effectiveHospital) {
      const institutions = dbManager.getAllInstitutions();
      const inst = institutions.find(
        (i) =>
          i.id.toLowerCase() === effectiveHospital ||
          i.gateway_public_key.toLowerCase() === effectiveHospital
      );
      if (inst && (inst.status === "SUSPENDED" || inst.status === "REVOKED")) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: `Institution '${inst.name}' is currently ${inst.status} by federation governance and cannot anchor records.` },
            { status: 403 }
          )
        );
      }
    }

    // 1. Check for Duplicate Record Upload (Idempotency / Anti-Collision)
    const existingById = dbManager.getRecord(recordId);
    if (existingById) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: `Duplicate record upload: Record ID '${recordId}' already exists in sovereign storage.` },
          { status: 409 }
        )
      );
    }

    const existingByHash = dbManager.getRecordByHash(recordHash);
    if (existingByHash) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: `Duplicate record upload: A record with this exact clinical content hash (${recordHash.slice(0, 16)}...) already exists.` },
          { status: 409 }
        )
      );
    }

    // 0. Validate file size (max 25 MB)
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const effectiveSize = fileSize || Buffer.byteLength(ciphertext, "utf-8");
    if (effectiveSize > MAX_FILE_SIZE) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: `File size (${(effectiveSize / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of 25 MB` },
          { status: 413 }
        )
      );
    }

    // 1. Validate ciphertext integrity against submitted cipherHash
    const computedCipherHash = computeSha256(ciphertext);
    if (computedCipherHash.toLowerCase() !== cipherHash.toLowerCase()) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            error: "Ciphertext hash mismatch: submitted cipherHash does not match calculated SHA-256 of payload",
            computed: computedCipherHash,
            expected: cipherHash,
          },
          { status: 400 }
        )
      );
    }

    // 2. Persist encrypted payload off-chain in /storage
    const safeRecordFileName = `${recordId.replace(/[^a-zA-Z0-9_-]/g, "")}.enc`;
    const storagePath = path.join(dbManager.storageDir, safeRecordFileName);
    const storagePayload = JSON.stringify({ ciphertext, iv });

    fs.writeFileSync(storagePath, storagePayload, "utf-8");

    // 3. Persist record metadata in SQLite
    dbManager.insertRecord({
      record_id: recordId,
      patient_pseudonym: patientPseudonym,
      record_type: recordType || "General",
      record_hash: recordHash,
      cipher_hash: cipherHash,
      issuer_hospital: issuerHospital || authenticatedUser?.hospitalWallet || authenticatedUser?.walletAddress || "",
      issuer_doctor: issuerDoctor || authenticatedUser?.walletAddress || "",
      issuer_signature: issuerSignature || "",
      storage_path: `storage/${safeRecordFileName}`,
      file_name: fileName || "record.dat",
      mime_type: mimeType || "application/json",
      file_size: fileSize || Buffer.byteLength(ciphertext, "utf-8"),
      version: version || 1,
      previous_record_id: previousRecordId || null,
      created_at: Date.now(),
      is_revoked: 0,
    });

    // 4. Persist recipient wrapped keys
    if (wrappedKeys && typeof wrappedKeys === "object") {
      for (const [recipientWallet, wrappedKey] of Object.entries(wrappedKeys)) {
        if (typeof wrappedKey === "string") {
          dbManager.insertWrappedKey(recordId, recipientWallet, wrappedKey);
        }
      }
    }

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        recordId,
        storageRef: `storage/${safeRecordFileName}`,
        cipherHash,
        version: version || 1,
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to process encrypted record upload" }, { status: 500 })
    );
  }
}
