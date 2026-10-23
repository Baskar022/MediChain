import { randomBytes } from "crypto";

export interface NonceRecord {
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
}

/**
 * Thread-safe In-Memory Nonce Store with automatic TTL expiry and single-use replay protection.
 */
class NonceStore {
  private store: Map<string, NonceRecord> = new Map();
  private readonly ttlMs: number = 5 * 60 * 1000; // 5-minute validity

  /**
   * Generates and stores a unique cryptographically random challenge nonce for a wallet.
   */
  public generateNonce(walletAddress: string): NonceRecord {
    const normalizedWallet = walletAddress.toLowerCase();
    const nonce = randomBytes(16).toString("hex");
    const now = Date.now();
    const expiresAt = now + this.ttlMs;

    const record: NonceRecord = {
      walletAddress: normalizedWallet,
      nonce,
      issuedAt: now,
      expiresAt,
      consumed: false,
    };

    this.store.set(this.getKey(normalizedWallet, nonce), record);
    this.cleanup();

    return record;
  }

  /**
   * Validates and atomically consumes a nonce. Once consumed, the nonce can never be reused.
   */
  public consumeNonce(walletAddress: string, nonce: string): boolean {
    const key = this.getKey(walletAddress.toLowerCase(), nonce);
    const record = this.store.get(key);

    if (!record) {
      return false;
    }

    if (record.consumed || Date.now() > record.expiresAt) {
      this.store.delete(key);
      return false;
    }

    // Atomically consume
    record.consumed = true;
    this.store.delete(key);
    return true;
  }

  /**
   * Removes expired nonces to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.expiresAt || record.consumed) {
        this.store.delete(key);
      }
    }
  }

  private getKey(wallet: string, nonce: string): string {
    return `${wallet}:${nonce}`;
  }

  public clear(): void {
    this.store.clear();
  }
}

export const nonceStore = new NonceStore();
