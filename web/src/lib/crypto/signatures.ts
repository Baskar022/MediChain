import { ethers } from "ethers";

/**
 * Signs a 32-byte recordHash using an ethers Signer or a private key.
 * Uses Ethereum Personal Sign standard (EIP-191) to match Solidity `MessageHashUtils.toEthSignedMessageHash`.
 * @param recordHash 0x-prefixed 32-byte hex hash of the plaintext record.
 * @param signerOrPrivateKey Ethers signer instance or private key string.
 */
export async function signRecordHash(
  recordHash: string,
  signerOrPrivateKey: ethers.Signer | string
): Promise<string> {
  const hashBytes = ethers.getBytes(recordHash);
  if (typeof signerOrPrivateKey === "string") {
    const wallet = new ethers.Wallet(signerOrPrivateKey);
    return wallet.signMessage(hashBytes);
  }
  return signerOrPrivateKey.signMessage(hashBytes);
}

/**
 * Recovers the Ethereum address that signed the recordHash.
 * @param recordHash 0x-prefixed 32-byte hex hash.
 * @param signature Hex-encoded ECDSA signature (65 bytes: r, s, v).
 */
export function recoverSignerAddress(recordHash: string, signature: string): string {
  try {
    const hashBytes = ethers.getBytes(recordHash);
    return ethers.verifyMessage(hashBytes, signature);
  } catch (err) {
    throw new Error(`Signature recovery failed: ${(err as Error).message}`);
  }
}

/**
 * Validates that an ECDSA signature over recordHash matches the expected doctor or hospital address.
 */
export function verifyRecordSignature(
  recordHash: string,
  signature: string,
  expectedSignerAddress: string
): boolean {
  try {
    const recovered = recoverSignerAddress(recordHash, signature);
    return recovered.toLowerCase() === expectedSignerAddress.toLowerCase();
  } catch {
    return false;
  }
}
