import { NextRequest, NextResponse } from "next/server";
import { verifySiweChallenge } from "@/lib/auth/siwe";
import { issueAuthToken, TokenPayload } from "@/lib/auth/jwt";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(req, 20, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many authentication attempts." }, { status: 429 })
    );
  }

  try {
    const body = await req.json();
    const { walletAddress, message, signature, role, hospitalWallet, patientIdHash } = body;

    if (!walletAddress || !message || !signature) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Missing required parameters: walletAddress, message, signature" },
          { status: 400 }
        )
      );
    }

    // Verify SIWE signature and enforce single-use nonce
    const verification = verifySiweChallenge(walletAddress, message, signature);
    if (!verification.success) {
      return applySecurityHeaders(
        NextResponse.json({ error: verification.error || "Authentication failed" }, { status: 401 })
      );
    }

    // Issue short-lived JWT session
    const payload: TokenPayload = {
      walletAddress,
      role: role || "PATIENT",
      hospitalWallet: hospitalWallet || undefined,
      patientIdHash: patientIdHash || undefined,
    };

    const token = await issueAuthToken(payload, "8h");

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        token,
        user: payload,
      })
    );
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Internal authentication error" }, { status: 500 })
    );
  }
}
