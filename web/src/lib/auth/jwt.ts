import { SignJWT, jwtVerify } from "jose";

const DEFAULT_SECRET = "medichain_secure_dev_jwt_key_at_least_32_bytes_long_12345";
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  walletAddress: string;
  role?: "ADMIN" | "HOSPITAL" | "DOCTOR" | "PATIENT" | "VERIFIER";
  hospitalWallet?: string;
  patientIdHash?: string;
  [key: string]: any;
}

/**
 * Issues a cryptographically signed, short-lived JSON Web Token (JWT) after successful SIWE authentication.
 */
export async function issueAuthToken(
  payload: TokenPayload,
  expiresIn: string = "8h"
): Promise<string> {
  const token = await new SignJWT({
    walletAddress: payload.walletAddress.toLowerCase(),
    role: payload.role || "PATIENT",
    hospitalWallet: payload.hospitalWallet ? payload.hospitalWallet.toLowerCase() : undefined,
    patientIdHash: payload.patientIdHash,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer("medichain-consortium")
    .setAudience("medichain-app")
    .sign(secretKey);

  return token;
}

/**
 * Verifies the validity, signature, and expiration of a JWT token.
 */
export async function verifyAuthToken(
  token: string
): Promise<{ valid: boolean; payload?: TokenPayload; error?: string }> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "medichain-consortium",
      audience: "medichain-app",
    });

    return {
      valid: true,
      payload: payload as unknown as TokenPayload,
    };
  } catch (err) {
    return {
      valid: false,
      error: (err as Error).message,
    };
  }
}
