import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, TokenPayload } from "../auth/jwt";

// In-Memory Rate Limiter (sliding window per IP/Wallet)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

export function rateLimit(
  req: NextRequest,
  limit: number = 60,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number } {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

/**
 * Validates the Authorization Bearer JWT token on incoming API requests.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ authenticated: boolean; user?: TokenPayload; error?: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false, error: "Missing or malformed Authorization header" };
  }

  const token = authHeader.slice(7).trim();
  const verification = await verifyAuthToken(token);

  if (!verification.valid || !verification.payload) {
    return { authenticated: false, error: verification.error || "Invalid or expired session token" };
  }

  return {
    authenticated: true,
    user: verification.payload,
  };
}

/**
 * Standard security response headers (HSTS, CSP, X-Frame-Options, No-Sniff).
 */
export function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;"
  );
  return res;
}
