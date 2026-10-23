import { PrivateKey, encrypt, decrypt } from "eciesjs";

export interface KeyPair {
  privateKeyHex: string;
  publicKeyHex: string;
}

/**
 * Generates an Elliptic Curve SECP256k1 key pair specifically for ECIES encryption and key wrapping.
 */
export function generateHospitalEncryptionKeyPair(): KeyPair {
  const k = new PrivateKey();
  return {
    privateKeyHex: k.toHex(),
    publicKeyHex: k.publicKey.toHex(),
  };
}

/**
 * Derives the corresponding public key from an existing private key.
 */
export function derivePublicKeyFromPrivate(privateKeyHex: string): string {
  const cleanHex = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const k = new PrivateKey(Buffer.from(cleanHex, "hex"));
  return k.publicKey.toHex();
}

/**
 * Wraps (encrypts) a symmetric AES record key for a designated recipient hospital.
 * @param recordKey 32-byte AES key (as Uint8Array or hex string).
 * @param recipientPublicKeyHex The recipient hospital's SECP256k1 public key.
 * @returns 0x-prefixed hex string of the ECIES ciphertext.
 */
export function wrapRecordKey(
  recordKey: Uint8Array | string,
  recipientPublicKeyHex: string
): string {
  let keyBuffer: Buffer;
  if (typeof recordKey === "string") {
    const cleanHex = recordKey.startsWith("0x") ? recordKey.slice(2) : recordKey;
    keyBuffer = Buffer.from(cleanHex, "hex");
  } else {
    keyBuffer = Buffer.from(recordKey);
  }

  const cleanPubKey = recipientPublicKeyHex.startsWith("0x")
    ? recipientPublicKeyHex.slice(2)
    : recipientPublicKeyHex;

  const wrappedBuffer = encrypt(cleanPubKey, keyBuffer);
  return "0x" + Buffer.from(wrappedBuffer).toString("hex");
}

/**
 * Unwraps (decrypts) a symmetric AES record key using the recipient hospital's private key.
 * @param wrappedKeyHex 0x-prefixed or raw hex string of the wrapped key.
 * @param recipientPrivateKeyHex The recipient's private key.
 * @returns Original 32-byte AES symmetric key.
 */
export function unwrapRecordKey(
  wrappedKeyHex: string,
  recipientPrivateKeyHex: string
): Uint8Array {
  const cleanWrappedHex = wrappedKeyHex.startsWith("0x") ? wrappedKeyHex.slice(2) : wrappedKeyHex;
  const cleanPrivHex = recipientPrivateKeyHex.startsWith("0x")
    ? recipientPrivateKeyHex.slice(2)
    : recipientPrivateKeyHex;

  const wrappedBuffer = Buffer.from(cleanWrappedHex, "hex");
  const unwrappedBuffer = decrypt(cleanPrivHex, wrappedBuffer);

  return new Uint8Array(unwrappedBuffer);
}

/**
 * Helper to wrap a record key for multiple recipient hospitals simultaneously.
 * @param recordKey The 32-byte AES record key.
 * @param recipientMap Dictionary mapping hospital wallet addresses to their public keys.
 * @returns Dictionary mapping hospital wallet addresses to their wrapped keys.
 */
export function wrapRecordKeyForRecipients(
  recordKey: Uint8Array | string,
  recipientMap: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [hospitalAddress, publicKey] of Object.entries(recipientMap)) {
    result[hospitalAddress.toLowerCase()] = wrapRecordKey(recordKey, publicKey);
  }
  return result;
}
