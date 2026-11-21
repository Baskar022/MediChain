import * as crypto from "crypto";
import { PrivateKey } from "eciesjs";
import { KeyPair } from "./ecies";

export const KEY_DERIVATION_DOMAIN = "MediChain Sovereign Decryption Key Derivation v1";
export const KEY_DERIVATION_MESSAGE = `${KEY_DERIVATION_DOMAIN}\n\nSign this message to derive your sovereign client-side decryption key. This request is free and will never cost gas or trigger a blockchain transaction.`;

export interface KeyDerivationDocumentation {
  mechanism: string;
  standards: string[];
  limitations: string[];
}

export const KEY_DERIVATION_DOCS: KeyDerivationDocumentation = {
  mechanism: "RFC 6979 Deterministic ECDSA signature over domain-separated message followed by HKDF-SHA256 (RFC 5869) key expansion to SECP256k1 scalar.",
  standards: ["RFC 6979", "RFC 5869", "SECP256k1", "ECIES"],
  limitations: [
    "Signature Exposure: If an attacker obtains the specific derivation signature, they can reproduce the private encryption key.",
    "Hardware Wallet Requirement: Key derivation depends on the wallet producing deterministic RFC 6979 signatures.",
    "Wallet Migration: Changing the underlying Ethereum wallet address requires existing medical records to have their symmetric AES keys re-wrapped.",
    "No Revocation of Prior Decryptions: Deriving new keys does not retroactively un-see previously decrypted plaintext records."
  ],
};

/**
 * Derives a deterministic SECP256k1 ECIES encryption key pair from a MetaMask RFC 6979 signature.
 * Eliminates deprecated MetaMask eth_getEncryptionPublicKey/eth_decrypt APIs.
 * 
 * @param signature Hex string of the signature produced over KEY_DERIVATION_MESSAGE
 * @param salt Optional domain salt (defaults to MEDICHAIN_HKDF_SALT_V1)
 */
export function deriveEncryptionKeypairFromSignature(
  signature: string,
  salt: string = "MEDICHAIN_HKDF_SALT_V1"
): KeyPair {
  if (!signature || signature.length < 130) {
    throw new Error("Invalid signature: expected 65-byte hex signature (r, s, v)");
  }

  const cleanSig = signature.startsWith("0x") ? signature.slice(2) : signature;
  const ikm = Buffer.from(cleanSig, "hex");

  // HKDF-SHA256 expansion: 32 bytes output
  const derivedBytes = crypto.hkdfSync(
    "sha256",
    ikm,
    Buffer.from(salt),
    Buffer.from("secp256k1_ecies_key"),
    32
  );

  const privateKey = new PrivateKey(Buffer.from(derivedBytes));

  return {
    privateKeyHex: privateKey.toHex(),
    publicKeyHex: privateKey.publicKey.toHex(),
  };
}
