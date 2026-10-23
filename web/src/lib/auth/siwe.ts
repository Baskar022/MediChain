import { ethers } from "ethers";
import { nonceStore } from "./nonceStore";

export interface SiweChallengeOptions {
  domain?: string;
  uri?: string;
  statement?: string;
  chainId?: number;
}

export interface SiweChallenge {
  message: string;
  nonce: string;
  walletAddress: string;
  issuedAt: string;
  expiresAt: string;
}

/**
 * Creates an EIP-4361 compliant challenge message containing a cryptographically unique nonce.
 */
export function createSiweChallenge(
  walletAddress: string,
  options?: SiweChallengeOptions
): SiweChallenge {
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid Ethereum address: ${walletAddress}`);
  }

  const checksummedAddress = ethers.getAddress(walletAddress);
  const nonceRecord = nonceStore.generateNonce(checksummedAddress);

  const domain = options?.domain || "medichain.local";
  const uri = options?.uri || "http://localhost:3000";
  const statement =
    options?.statement ||
    "Sign in to MediChain: Secure Inter-Hospital Medical Record Sharing.\nThis request does not trigger any blockchain transaction or gas fee.";
  const chainId = options?.chainId || 31337;

  const issuedAt = new Date(nonceRecord.issuedAt).toISOString();
  const expiresAt = new Date(nonceRecord.expiresAt).toISOString();

  const message = [
    `${domain} wants you to sign in with your Ethereum account:`,
    `${checksummedAddress}`,
    ``,
    `${statement}`,
    ``,
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonceRecord.nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join("\n");

  return {
    message,
    nonce: nonceRecord.nonce,
    walletAddress: checksummedAddress,
    issuedAt,
    expiresAt,
  };
}

/**
 * Parses and verifies a signed SIWE challenge message.
 * Enforces single-use nonce consumption to strictly prevent replay attacks.
 */
export function verifySiweChallenge(
  walletAddress: string,
  message: string,
  signature: string
): { success: boolean; error?: string } {
  if (!walletAddress || !message || !signature) {
    return { success: false, error: "Missing required authentication parameters" };
  }

  // 1. Extract nonce from challenge message
  const nonceMatch = message.match(/Nonce:\s*([a-fA-F0-9]+)/);
  if (!nonceMatch) {
    return { success: false, error: "Malformed SIWE message: missing nonce" };
  }
  const nonce = nonceMatch[1];

  // 2. Extract expiration time
  const expiryMatch = message.match(/Expiration Time:\s*([^\n]+)/);
  if (expiryMatch) {
    const expiresAt = new Date(expiryMatch[1].trim()).getTime();
    if (Date.now() > expiresAt) {
      return { success: false, error: "Authentication challenge has expired" };
    }
  }

  // 3. Atomically consume the nonce (Replay Protection)
  const consumed = nonceStore.consumeNonce(walletAddress, nonce);
  if (!consumed) {
    return {
      success: false,
      error: "Invalid or already consumed nonce (replay protection triggered)",
    };
  }

  // 4. Cryptographic signature recovery
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return {
        success: false,
        error: "Signature does not match the claimed wallet address",
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `ECDSA signature verification failed: ${(err as Error).message}`,
    };
  }
}
