import { ethers } from "ethers";

/**
 * Computes the SHA-256 hash of an arbitrary payload (string, Buffer, or Uint8Array).
 * @param input The data to hash.
 * @returns 0x-prefixed 32-byte hex string matching on-chain `bytes32`.
 */
export function computeSha256(input: string | Uint8Array | Buffer): string {
  if (typeof input === "string") {
    // If it's already a hex string, hash the decoded bytes or utf-8?
    // In medical records, if plain text or JSON string, convert via toUtf8Bytes
    const bytes = ethers.toUtf8Bytes(input);
    return ethers.sha256(bytes);
  }
  return ethers.sha256(input);
}

/**
 * Generates a pseudonymous patient identifier hash from their official/national ID and salt.
 * Ensures zero PII (name, SSN, national ID) is ever exposed on-chain.
 * @param patientRealId The patient's real ID (e.g., SSN, Aadhaar, MRN).
 * @param salt Secret or hospital-specific cryptographic salt.
 * @returns 0x-prefixed 32-byte pseudonymous hash.
 */
export function hashPatientId(patientRealId: string, salt: string): string {
  if (!patientRealId || !salt) {
    throw new Error("Patient ID and salt are both required for pseudonym derivation");
  }
  const payload = `PATIENT_PSEUDONYM:${patientRealId.trim().toUpperCase()}:${salt}`;
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

/**
 * Convenient wrapper with default consortium salt.
 */
export function derivePatientPseudonym(patientRealId: string, salt: string = "MEDICHAIN_CONSORTIUM_SALT_V1"): string {
  return hashPatientId(patientRealId, salt);
}

/**
 * Compares two hashes in constant time to prevent timing attacks.
 */
export function secureHashCompare(hashA: string, hashB: string): boolean {
  if (!hashA || !hashB) return false;
  const a = hashA.toLowerCase();
  const b = hashB.toLowerCase();
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
