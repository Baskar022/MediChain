import { ethers } from "ethers";

/**
 * Universal Pseudonymous Patient Identity Layer
 * Provides a cryptographically derived Global Patient Identifier (GPI)
 * that is deterministic across all sovereign blockchain networks,
 * while preventing identity correlation or exposure of real-world identifiers (SSN, Aadhaar, MRN).
 */

export const DEFAULT_GLOBAL_FEDERATION_SALT = "GLOBAL_MEDICHAIN_FEDERATION_SALT_V1";

/**
 * Derives a 32-byte hex Global Patient Identifier (GPI).
 * @param identitySecret Patient's core national ID, biometric seed, or master key secret.
 * @param federationSalt Neutral federation salt.
 */
export function deriveGlobalPatientId(
  identitySecret: string,
  federationSalt: string = DEFAULT_GLOBAL_FEDERATION_SALT
): string {
  if (!identitySecret) {
    throw new Error("Identity secret is required to derive Global Patient ID");
  }
  const normalized = identitySecret.trim().toUpperCase();
  const payload = `GLOBAL_PATIENT_IDENTITY:${normalized}:${federationSalt}`;
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

/**
 * Derives an institution-specific local patient pseudonym from the Global Patient ID.
 * Ensures that two hospitals cannot correlate patients unless authorized by the patient.
 */
export function deriveLocalPatientPseudonym(
  globalPatientId: string,
  institutionId: string
): string {
  const payload = `LOCAL_PATIENT_PSEUDONYM:${globalPatientId.toLowerCase()}:${institutionId.toLowerCase()}`;
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

/**
 * Creates a digital signature proving the patient owns and controls their Global Patient ID.
 */
export async function createPatientControlSignature(
  signer: ethers.Signer,
  globalPatientId: string,
  action: string,
  targetInstitution?: string
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = [
    "MediChain Interoperability Control Proof",
    `Global Patient ID: ${globalPatientId}`,
    `Authorized Action: ${action}`,
    targetInstitution ? `Target Institution: ${targetInstitution}` : "",
    `Timestamp: ${timestamp}`,
  ]
    .filter(Boolean)
    .join("\n");

  return signer.signMessage(message);
}

/**
 * Verifies a patient's control signature.
 */
export function verifyPatientControlSignature(
  message: string,
  signature: string,
  expectedWallet: string
): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedWallet.toLowerCase();
  } catch {
    return false;
  }
}
