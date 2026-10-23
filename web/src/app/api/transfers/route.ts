import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/db";
import { authenticateRequest, rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export type TransferState =
  | "REQUESTED"
  | "CONSENT_GIVEN"
  | "RELEASED"
  | "VERIFIED"
  | "AVAILABLE"
  | "REJECTED"
  | "REVOKED"
  | "EXPIRED"
  | "QUEUED_OFFLINE";

const VALID_TRANSITIONS: Record<TransferState, TransferState[]> = {
  REQUESTED: ["CONSENT_GIVEN", "REJECTED", "EXPIRED", "QUEUED_OFFLINE"],
  CONSENT_GIVEN: ["RELEASED", "REVOKED", "EXPIRED", "QUEUED_OFFLINE"],
  RELEASED: ["VERIFIED", "REVOKED", "QUEUED_OFFLINE"],
  VERIFIED: ["AVAILABLE", "REVOKED"],
  AVAILABLE: ["REVOKED"],
  REJECTED: [],
  REVOKED: [],
  EXPIRED: [],
  QUEUED_OFFLINE: ["REQUESTED", "RELEASED", "REJECTED"],
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const patient = url.searchParams.get("patient");
  const hospital = url.searchParams.get("hospital");
  const status = url.searchParams.get("status");

  let transfers = dbManager.getAllAccessRequests();

  if (patient) {
    transfers = transfers.filter(
      (t) => t.patient_pseudonym.toLowerCase() === patient.toLowerCase()
    );
  }
  if (hospital) {
    transfers = transfers.filter(
      (t) => t.requesting_hospital.toLowerCase() === hospital.toLowerCase()
    );
  }
  if (status) {
    transfers = transfers.filter((t) => t.status.toUpperCase() === status.toUpperCase());
  }

  return applySecurityHeaders(
    NextResponse.json({
      transfers,
      count: transfers.length,
    })
  );
}

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 40, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many transfer requests. Rate limit exceeded." }, { status: 429 })
    );
  }

  // Authentication check (optional Bearer JWT)
  const authHeader = req.headers.get("authorization");
  let authenticatedUser: any = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const auth = await authenticateRequest(req);
    if (auth.authenticated) {
      authenticatedUser = auth.user;
    }
  }

  try {
    const body = await req.json();
    const {
      action = "CREATE", // "CREATE" | "TRANSITION"
      transferId,
      recordId,
      patientPseudonym,
      requestingHospital,
      requestingDoctor,
      reason,
      scope = "SpecificRecord",
      targetState,
      rejectionReason,
      gatewayOfflineSimulate,
    } = body;

    // 1. CREATE TRANSFER REQUEST
    if (action === "CREATE") {
      if (!patientPseudonym || !requestingHospital || !requestingDoctor || !reason) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: "Missing required fields: patientPseudonym, requestingHospital, requestingDoctor, reason" },
            { status: 400 }
          )
        );
      }

      // Check role permissions: Patients cannot create transfer requests (only doctors/clinics)
      if (authenticatedUser && authenticatedUser.role === "PATIENT") {
        return applySecurityHeaders(
          NextResponse.json(
            { error: "Access Denied: Patients cannot initiate hospital transfer requests. Must be requested by treating physician." },
            { status: 403 }
          )
        );
      }

      // Check if requesting institution is suspended
      const institutions = dbManager.getAllInstitutions();
      const inst = institutions.find(
        (i) =>
          i.id.toLowerCase() === requestingHospital.toLowerCase() ||
          i.gateway_public_key.toLowerCase() === requestingHospital.toLowerCase()
      );
      if (inst && (inst.status === "SUSPENDED" || inst.status === "REVOKED")) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: `Requesting institution '${inst.name}' is ${inst.status} by federation governance and cannot initiate transfers.` },
            { status: 403 }
          )
        );
      }

      // Check if record exists (if specific record requested)
      if (recordId) {
        const record = dbManager.getRecord(recordId);
        if (!record) {
          return applySecurityHeaders(
            NextResponse.json({ error: `Record '${recordId}' does not exist in sovereign storage.` }, { status: 404 })
          );
        }
        if (record.is_revoked) {
          return applySecurityHeaders(
            NextResponse.json({ error: `Cannot transfer revoked record '${recordId}'.` }, { status: 403 })
          );
        }

        // Idempotency check: prevent duplicate transfer request
        const existing = dbManager.findExistingTransfer(recordId, requestingHospital);
        if (existing) {
          return applySecurityHeaders(
            NextResponse.json(
              {
                error: `Duplicate transfer rejected: An active transfer for record '${recordId}' to hospital '${requestingHospital}' already exists.`,
                existingTransferId: existing.id,
                currentStatus: existing.status,
              },
              { status: 409 }
            )
          );
        }
      }

      const id = transferId || `xfer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const initialState: TransferState = gatewayOfflineSimulate ? "QUEUED_OFFLINE" : "REQUESTED";

      const newTransfer = dbManager.createAccessRequest({
        id,
        patient_pseudonym: patientPseudonym,
        record_id: recordId || null,
        requesting_hospital: requestingHospital,
        requesting_doctor: requestingDoctor,
        reason,
        scope,
      });

      // Update to correct initial state if simulated offline or requested
      dbManager.updateAccessRequestStatus(id, initialState);

      return applySecurityHeaders(
        NextResponse.json({
          success: true,
          transfer: {
            ...newTransfer,
            status: initialState,
          },
          message:
            initialState === "QUEUED_OFFLINE"
              ? "Gateway is currently offline. Envelope queued with exponential backoff retry."
              : "Cross-chain transfer request successfully initiated and routed to Interop Hub.",
        })
      );
    }

    // 2. TRANSITION STATE MACHINE
    if (action === "TRANSITION") {
      if (!transferId || !targetState) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: "transferId and targetState are required for TRANSITION action." },
            { status: 400 }
          )
        );
      }

      const transfer = dbManager.getAccessRequestById(transferId);
      if (!transfer) {
        return applySecurityHeaders(
          NextResponse.json({ error: `Transfer '${transferId}' not found.` }, { status: 404 })
        );
      }

      const currentState = (transfer.status.toUpperCase() as TransferState) || "REQUESTED";
      const normalizedTarget = targetState.toUpperCase() as TransferState;

      // Validate state machine progression
      const allowedNextStates = VALID_TRANSITIONS[currentState] || [];
      if (!allowedNextStates.includes(normalizedTarget)) {
        return applySecurityHeaders(
          NextResponse.json(
            {
              error: `Invalid transfer state transition: Cannot move from '${currentState}' to '${normalizedTarget}'.`,
              validTransitions: allowedNextStates,
            },
            { status: 400 }
          )
        );
      }

      // Check for Revocation & Expired restrictions
      if (currentState === "REVOKED" || currentState === "EXPIRED" || currentState === "REJECTED") {
        return applySecurityHeaders(
          NextResponse.json(
            { error: `Transfer is in terminal state '${currentState}' and cannot be transitioned.` },
            { status: 400 }
          )
        );
      }

      dbManager.updateAccessRequestStatus(transferId, normalizedTarget);

      return applySecurityHeaders(
        NextResponse.json({
          success: true,
          transferId,
          previousState: currentState,
          currentState: normalizedTarget,
          rejectionReason: normalizedTarget === "REJECTED" ? rejectionReason || "Consent denied by patient" : undefined,
          message: `Transfer successfully advanced to '${normalizedTarget}'.`,
        })
      );
    }

    return applySecurityHeaders(
      NextResponse.json({ error: `Unsupported action '${action}'. Use 'CREATE' or 'TRANSITION'.` }, { status: 400 })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to process transfer request" }, { status: 500 })
    );
  }
}
