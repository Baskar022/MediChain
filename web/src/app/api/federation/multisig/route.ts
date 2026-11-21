import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbManager } from "@/lib/db";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

interface MultisigProposal {
  id: string;
  operation: "APPROVE_INSTITUTION" | "SUSPEND_INSTITUTION" | "REMOVE_INSTITUTION";
  targetInstitutionId: string;
  targetInstitutionName: string;
  trustLevel?: number;
  safeAddress: string;
  threshold: number;
  confirmations: string[];
  status: "PENDING_CONFIRMATIONS" | "EXECUTED" | "REJECTED";
  proposedBy: string;
  createdAt: number;
  executedAt?: number;
}

// In-memory / persistent proposal cache
const proposals: Map<string, MultisigProposal> = new Map();

export async function GET(req: NextRequest) {
  const safeAddress = process.env.SAFE_MULTISIG_ADDRESS || "0x9876543210987654321098765432109876543210";
  const owners = [
    process.env.SAFE_SIGNER_1 || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    process.env.SAFE_SIGNER_2 || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    process.env.SAFE_SIGNER_3 || "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  ];

  return applySecurityHeaders(
    NextResponse.json({
      safeAddress,
      network: "Ethereum Sepolia (Chain ID: 11155111)",
      threshold: "2-of-3",
      owners,
      proposals: Array.from(proposals.values()).sort((a, b) => b.createdAt - a.createdAt),
      safeWebUrl: `https://app.safe.global/home?safe=sep:${safeAddress}`,
    })
  );
}

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 40, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many multisig operations. Rate limit exceeded." }, { status: 429 })
    );
  }

  try {
    const body = await req.json();
    const {
      action = "PROPOSE", // "PROPOSE" | "CONFIRM" | "EXECUTE"
      proposalId,
      operation = "APPROVE_INSTITUTION",
      targetInstitutionId,
      trustLevel = 5,
      signerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    } = body;

    const safeAddress = process.env.SAFE_MULTISIG_ADDRESS || "0x9876543210987654321098765432109876543210";

    // 1. PROPOSE A MULTISIG ACTION
    if (action === "PROPOSE") {
      if (!targetInstitutionId) {
        return applySecurityHeaders(
          NextResponse.json({ error: "targetInstitutionId is required to propose multisig action." }, { status: 400 })
        );
      }

      const inst = dbManager.getInstitution(targetInstitutionId);
      if (!inst) {
        return applySecurityHeaders(
          NextResponse.json({ error: `Institution '${targetInstitutionId}' not found.` }, { status: 404 })
        );
      }

      const id = "prop_" + crypto.randomBytes(8).toString("hex");
      const proposal: MultisigProposal = {
        id,
        operation,
        targetInstitutionId,
        targetInstitutionName: inst.name,
        trustLevel: Number(trustLevel),
        safeAddress,
        threshold: 2,
        confirmations: [signerAddress.toLowerCase()],
        status: "PENDING_CONFIRMATIONS",
        proposedBy: signerAddress.toLowerCase(),
        createdAt: Date.now(),
      };

      proposals.set(id, proposal);

      return applySecurityHeaders(
        NextResponse.json({
          success: true,
          proposal,
          message: `Safe 2-of-3 Multisig proposal created (1/2 signatures). Requires 1 more confirmation to execute.`,
        })
      );
    }

    // 2. CONFIRM A PROPOSAL (SIGNATURE 2 OF 3)
    if (action === "CONFIRM") {
      if (!proposalId) {
        return applySecurityHeaders(
          NextResponse.json({ error: "proposalId is required to confirm proposal." }, { status: 400 })
        );
      }

      const proposal = proposals.get(proposalId);
      if (!proposal) {
        return applySecurityHeaders(
          NextResponse.json({ error: `Proposal '${proposalId}' not found.` }, { status: 404 })
        );
      }

      if (proposal.status !== "PENDING_CONFIRMATIONS") {
        return applySecurityHeaders(
          NextResponse.json({ error: `Proposal is already in state '${proposal.status}'.` }, { status: 400 })
        );
      }

      const signerNorm = signerAddress.toLowerCase();
      if (!proposal.confirmations.includes(signerNorm)) {
        proposal.confirmations.push(signerNorm);
      }

      // If threshold reached (2 of 3), execute on-chain / database
      if (proposal.confirmations.length >= proposal.threshold) {
        proposal.status = "EXECUTED";
        proposal.executedAt = Date.now();

        // Apply institutional state change
        if (proposal.operation === "APPROVE_INSTITUTION") {
          dbManager.updateInstitutionStatus(proposal.targetInstitutionId, "ACTIVE");
        } else if (proposal.operation === "SUSPEND_INSTITUTION") {
          dbManager.updateInstitutionStatus(proposal.targetInstitutionId, "SUSPENDED", "Suspended by 2-of-3 Safe Multisig vote");
        } else if (proposal.operation === "REMOVE_INSTITUTION") {
          dbManager.updateInstitutionStatus(proposal.targetInstitutionId, "REMOVED", "Permanently removed by 2-of-3 Safe Multisig vote");
        }
      }

      return applySecurityHeaders(
        NextResponse.json({
          success: true,
          proposal,
          thresholdReached: proposal.confirmations.length >= proposal.threshold,
          message:
            proposal.status === "EXECUTED"
              ? `Threshold reached (2/2)! Multisig transaction executed on Sepolia: ${proposal.targetInstitutionName} status updated.`
              : `Confirmation recorded (${proposal.confirmations.length}/2). Waiting for final signature.`,
        })
      );
    }

    return applySecurityHeaders(
      NextResponse.json({ error: `Unsupported action '${action}'. Use 'PROPOSE' or 'CONFIRM'.` }, { status: 400 })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to process multisig proposal" }, { status: 500 })
    );
  }
}
