import { ethers } from "ethers";

export type MessageEnvelopeType =
  | "REQUEST_RECORDS"
  | "CONSENT_PROOF"
  | "RECORD_PACKAGE"
  | "REVOKE"
  | "EMERGENCY_ACCESS"
  | "AUDIT_ACK";

/**
 * FHIR-inspired Record Metadata Specification (R4 compatible subset)
 * Enables syntactic and semantic interoperability between diverse hospital EHR schemas.
 */
export interface FHIRResourceHeader {
  resourceType: "DocumentReference" | "DiagnosticReport" | "Observation";
  id: string; // Record ID
  status: "current" | "superseded" | "entered-in-error";
  category: string; // e.g., "Cardiology", "Hematology", "Radiology"
  date: string; // ISO 8601
  subject: {
    reference: string; // globalPatientId
    display?: string; // pseudonymous display
  };
  custodian: {
    reference: string; // institutionId
    display: string; // Hospital / Lab legal name
  };
  content: {
    attachment: {
      contentType: string; // e.g. "application/json", "application/pdf"
      hash: string; // Plaintext SHA-256 hash
      cipherHash: string; // Ciphertext SHA-256 hash
      size?: number;
      title?: string;
    };
  };
}

/**
 * Standard Message Envelope for Cross-Chain Communication
 * Versioned, tamper-evident, authenticated by the sending Gateway's private key.
 */
export interface MessageEnvelope<T = any> {
  version: "1.0.0";
  messageId: string;
  type: MessageEnvelopeType;
  fromInstitution: string;
  toInstitution: string;
  globalPatientId: string;
  scope: string; // "ALL_RECORDS", "CRITICAL_SUMMARY", or specific record ID
  nonce: string;
  issuedAt: number; // Unix timestamp seconds
  expiresAt: number; // Unix timestamp seconds
  payload: T;
  signature: string; // Hex-encoded ECDSA signature of canonical envelope digest
  gatewayPubKey: string; // Public key of sending Gateway for verification
}

/**
 * Payload Schemas
 */
export interface RequestRecordsPayload {
  reason: string;
  urgency: "ROUTINE" | "URGENT" | "EMERGENCY";
  requestingDoctorName: string;
  requestingDoctorLicense: string;
  requestedRecordIds?: string[];
  callbackUrl?: string;
}

export interface ConsentProofPayload {
  consentId: string;
  sourceChainId: string;
  sourceBlockNumber: number;
  validUntil: number;
  scope: string;
  patientSignature?: string;
  attestationSignature: string; // Signed by source Gateway
}

export interface RecordPackageItem {
  recordId: string;
  fhirMetadata: FHIRResourceHeader;
  encryptedBlobBase64: string; // Ciphertext
  ivBase64: string;
  wrappedKeyHex: string; // AES-256 record key re-wrapped with Destination Hospital's ECIES public key
  sourceChain: {
    chainIdentifier: string;
    blockNumber: number;
    blockHash: string;
    merkleProof: string[];
    rootHash: string;
  };
  issuerSignature: string; // Doctor's digital signature on plaintext hash
}

export interface RecordPackagePayload {
  requestId: string;
  records: RecordPackageItem[];
  sourceGatewayAttestation: string;
}

export interface RevokePayload {
  consentId: string;
  sourceChainId: string;
  revokedAt: number;
  reason: string;
}

export interface EmergencyAccessPayload {
  emergencyAccessId: string;
  doctorWallet: string;
  doctorName: string;
  clinicalJustification: string;
  timeBoxSeconds: number; // e.g. 86400 (24h)
  emergencyLevel: "LEVEL_1_TRAUMA" | "RESUSCITATION" | "UNCONSCIOUS";
  sourceChainId: string;
}

/**
 * Computes canonical hash of message envelope contents (excluding signature).
 */
export function computeEnvelopeDigest(envelope: Omit<MessageEnvelope, "signature">): string {
  const canonicalData = {
    version: envelope.version,
    messageId: envelope.messageId,
    type: envelope.type,
    fromInstitution: envelope.fromInstitution,
    toInstitution: envelope.toInstitution,
    globalPatientId: envelope.globalPatientId,
    scope: envelope.scope,
    nonce: envelope.nonce,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    payload: envelope.payload,
    gatewayPubKey: envelope.gatewayPubKey,
  };

  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(canonicalData)));
}

/**
 * Signs an envelope with a Gateway private key or ethers Signer.
 */
export async function signEnvelope<T>(
  envelopeData: Omit<MessageEnvelope<T>, "signature" | "version">,
  signer: ethers.Signer
): Promise<MessageEnvelope<T>> {
  const unsignedEnvelope: Omit<MessageEnvelope<T>, "signature"> = {
    ...envelopeData,
    version: "1.0.0",
  };

  const digest = computeEnvelopeDigest(unsignedEnvelope);
  const signature = await signer.signMessage(ethers.getBytes(digest));

  return {
    ...unsignedEnvelope,
    signature,
  };
}

/**
 * Verifies that an envelope was legitimately signed by the claimed Gateway.
 */
export function verifyEnvelopeSignature(envelope: MessageEnvelope): {
  isValid: boolean;
  recoveredAddress: string;
  reason?: string;
} {
  try {
    const { signature, ...unsigned } = envelope;
    const digest = computeEnvelopeDigest(unsigned);
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(digest), signature);

    return {
      isValid: true,
      recoveredAddress,
    };
  } catch (err: any) {
    return {
      isValid: false,
      recoveredAddress: ethers.ZeroAddress,
      reason: err.message || "Invalid signature",
    };
  }
}

/**
 * Checks if an envelope has expired.
 */
export function isEnvelopeExpired(envelope: MessageEnvelope): boolean {
  const now = Math.floor(Date.now() / 1000);
  return envelope.expiresAt <= now;
}
