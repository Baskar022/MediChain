/**
 * AES-256-GCM Isomorphic Authenticated Encryption Module
 * Operates uniformly in both modern Browser (Web Crypto API) and Node.js environments.
 */

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded ciphertext (including 16-byte GCM auth tag)
  iv: string; // Base64 encoded 12-byte initialization vector
  keyHex?: string; // Optional hex-encoded key for reference
}

/**
 * Generates a cryptographically random 256-bit (32-byte) AES key.
 */
export function generateRecordKey(): Uint8Array {
  const key = new Uint8Array(32);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(key);
  } else {
    // Node.js fallback
    const nodeCrypto = require("crypto");
    const bytes = nodeCrypto.randomBytes(32);
    key.set(bytes);
  }
  return key;
}

/**
 * Encrypts data using AES-256-GCM.
 * @param data Plaintext data as a UTF-8 string or raw byte array.
 * @param existingKey Optional 32-byte key. If not provided, a secure random key is generated.
 */
export async function encryptRecord(
  data: string | Uint8Array,
  existingKey?: Uint8Array
): Promise<{ payload: EncryptedPayload; key: Uint8Array; keyHex: string }> {
  const key = existingKey || generateRecordKey();
  if (key.length !== 32) {
    throw new Error("AES-256 requires exactly a 32-byte (256-bit) key");
  }

  const plainBytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const iv = new Uint8Array(12); // Standard 96-bit IV for AES-GCM

  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(iv);
  } else {
    const nodeCrypto = require("crypto");
    iv.set(nodeCrypto.randomBytes(12));
  }

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    key as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    cryptoKey,
    plainBytes as unknown as BufferSource
  );

  const ciphertextBase64 = bufferToBase64(new Uint8Array(cipherBuffer));
  const ivBase64 = bufferToBase64(iv);
  const keyHex = "0x" + Array.from(key).map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    payload: {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
    },
    key,
    keyHex,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload and verifies the integrity auth tag.
 * Throws an error immediately if the ciphertext, IV, or key was tampered with.
 */
export async function decryptRecord(
  payload: EncryptedPayload | string,
  key: Uint8Array | string
): Promise<Uint8Array> {
  let parsedPayload: EncryptedPayload;
  if (typeof payload === "string") {
    parsedPayload = JSON.parse(payload);
  } else {
    parsedPayload = payload;
  }

  let keyBytes: Uint8Array;
  if (typeof key === "string") {
    const cleanHex = key.startsWith("0x") ? key.slice(2) : key;
    keyBytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  } else {
    keyBytes = key;
  }

  if (keyBytes.length !== 32) {
    throw new Error("Invalid key length: AES-256 requires 32 bytes");
  }

  const iv = base64ToBuffer(parsedPayload.iv);
  const cipherWithTag = base64ToBuffer(parsedPayload.ciphertext);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  try {
    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      cryptoKey,
      cipherWithTag as unknown as BufferSource
    );
    return new Uint8Array(decryptedBuffer);
  } catch (err) {
    throw new Error("Decryption failed: integrity verification check failed (tampered ciphertext or invalid key)");
  }
}

/**
 * Convenience helper to decrypt payload directly to UTF-8 text.
 */
export async function decryptRecordToText(
  payload: EncryptedPayload | string,
  key: Uint8Array | string
): Promise<string> {
  const bytes = await decryptRecord(payload, key);
  return new TextDecoder().decode(bytes);
}

// Helpers
export function bufferToBase64(buffer: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
