import { NextRequest, NextResponse } from "next/server";
import { createSiweChallenge } from "@/lib/auth/siwe";
import { rateLimit, applySecurityHeaders } from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  const { allowed } = rateLimit(req, 30, 60 * 1000);
  if (!allowed) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    );
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Query parameter 'address' is required." }, { status: 400 })
    );
  }

  try {
    const challenge = createSiweChallenge(address, {
      domain: req.headers.get("host") || "medichain.local",
      uri: req.nextUrl.origin,
      chainId: 31337,
    });

    return applySecurityHeaders(NextResponse.json(challenge));
  } catch (err: any) {
    return applySecurityHeaders(
      NextResponse.json({ error: err.message || "Failed to generate nonce" }, { status: 400 })
    );
  }
}
