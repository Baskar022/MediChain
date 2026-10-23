import { ethers } from "ethers";
import {
  MessageEnvelope,
  verifyEnvelopeSignature,
  isEnvelopeExpired,
} from "../types/envelope";
import { FederationManager } from "../federation/FederationManager";

export interface HubAuditLogEntry {
  messageId: string;
  type: string;
  fromInstitution: string;
  toInstitution: string;
  globalPatientId: string;
  status: "DELIVERED" | "QUEUED" | "REJECTED";
  timestamp: number;
  reason?: string;
}

export interface QueuedMessage {
  envelope: MessageEnvelope;
  attempts: number;
  nextAttemptTime: number;
  maxAttempts: number;
}

export interface IGatewayEndpoint {
  institutionId: string;
  receiveMessage(envelope: MessageEnvelope): Promise<{ success: boolean; responsePayload?: any; error?: string }>;
  isOnline(): boolean;
}

/**
 * Interop Hub
 * Neutral, zero-knowledge routing hub connecting sovereign healthcare blockchains.
 *
 * Security & Integrity Guarantees:
 * 1. Zero PHI: Inspects only signed envelope metadata and hashes; never sees plaintext.
 * 2. Strict Replay Protection: Consumes nonces and messageIds with anti-replay memory.
 * 3. Federation Enforcement: Rejects messages from or to suspended/unregistered institutions.
 * 4. Fault-Tolerant Delivery: Queues messages with exponential backoff if destination gateway is offline.
 * 5. Full Message Transit Audit Log: Records immutable routing events.
 */
export class InteropHub {
  private federation: FederationManager;
  private gateways: Map<string, IGatewayEndpoint> = new Map();

  // Replay Protection Stores
  private consumedMessageIds: Set<string> = new Set();
  private consumedNonces: Set<string> = new Set();

  // Offline retry queue
  private queuedMessages: Map<string, QueuedMessage> = new Map();

  // Transit Audit Log
  private transitLogs: HubAuditLogEntry[] = [];

  constructor(federation: FederationManager) {
    this.federation = federation;
  }

  /**
   * Registers a live Gateway endpoint with the Hub.
   */
  public registerGateway(institutionId: string, gateway: IGatewayEndpoint): void {
    this.gateways.set(institutionId.toLowerCase(), gateway);
  }

  /**
   * Routes an incoming signed message envelope between institutions.
   */
  public async routeMessage(envelope: MessageEnvelope): Promise<{
    status: "DELIVERED" | "QUEUED" | "REJECTED";
    messageId: string;
    responsePayload?: any;
    reason?: string;
  }> {
    const now = Math.floor(Date.now() / 1000);

    // 1. Replay Protection: Check messageId
    if (this.consumedMessageIds.has(envelope.messageId)) {
      this.logAudit(envelope, "REJECTED", "Replay detected: messageId already processed");
      return {
        status: "REJECTED",
        messageId: envelope.messageId,
        reason: "REPLAY_ATTACK_DETECTED: duplicate messageId",
      };
    }

    // 2. Replay Protection: Check nonce
    const nonceKey = `${envelope.fromInstitution.toLowerCase()}:${envelope.nonce}`;
    if (this.consumedNonces.has(nonceKey)) {
      this.logAudit(envelope, "REJECTED", "Replay detected: duplicate nonce from sender");
      return {
        status: "REJECTED",
        messageId: envelope.messageId,
        reason: "REPLAY_ATTACK_DETECTED: duplicate nonce",
      };
    }

    // 3. Expiration Check
    if (isEnvelopeExpired(envelope)) {
      this.logAudit(envelope, "REJECTED", "Envelope has expired");
      return {
        status: "REJECTED",
        messageId: envelope.messageId,
        reason: "MESSAGE_EXPIRED: issued timestamp exceeded expiry",
      };
    }

    // 4. Verify Sender Federation Membership & Active Status
    const sender = this.federation.getMember(envelope.fromInstitution);
    if (!sender || sender.status !== "ACTIVE") {
      this.logAudit(envelope, "REJECTED", "Sender not an active federation member");
      return {
        status: "REJECTED",
        messageId: envelope.messageId,
        reason: "UNAUTHORIZED_SENDER: institution suspended or not registered",
      };
    }

    // 5. Verify Cryptographic Gateway Signature
    const sigVerification = verifyEnvelopeSignature(envelope);
    if (!sigVerification.isValid) {
      this.logAudit(envelope, "REJECTED", "Invalid cryptographic signature");
      return {
        status: "REJECTED",
        messageId: envelope.messageId,
        reason: `SIGNATURE_VERIFICATION_FAILED: ${sigVerification.reason}`,
      };
    }

    // Verify recovered address matches sender's registered Gateway address
    if (sigVerification.recoveredAddress.toLowerCase() !== sender.gatewayAddress.toLowerCase()) {
      this.logAudit(envelope, "REJECTED", "Gateway signer does not match registered federation authority");
      return {
        status: "REJECTED",
        messageId: envelope.messageId,
        reason: "SIGNATURE_AUTHORITY_MISMATCH: recovered address is not the institution's registered gateway",
      };
    }

    // 6. Verify Recipient Federation Membership
    const recipient = this.federation.getMember(envelope.toInstitution);
    if (!recipient || recipient.status !== "ACTIVE") {
      this.logAudit(envelope, "REJECTED", "Recipient institution not active in federation");
      return {
        status: "REJECTED",
        messageId: envelope.messageId,
        reason: "RECIPIENT_INACTIVE: destination hospital is suspended or does not exist",
      };
    }

    // Consume messageId and nonce (anti-replay finalized)
    this.consumedMessageIds.add(envelope.messageId);
    this.consumedNonces.add(nonceKey);

    // 7. Deliver to Destination Gateway
    const targetGateway = this.gateways.get(envelope.toInstitution.toLowerCase());

    if (!targetGateway || !targetGateway.isOnline()) {
      // Destination is offline: Queue for retry with exponential backoff
      this.queueMessage(envelope);
      this.logAudit(envelope, "QUEUED", "Destination gateway offline; message enqueued for retry");
      return {
        status: "QUEUED",
        messageId: envelope.messageId,
        reason: "DESTINATION_OFFLINE: message enqueued in hub retry buffer",
      };
    }

    try {
      const delivery = await targetGateway.receiveMessage(envelope);
      if (delivery.success) {
        this.logAudit(envelope, "DELIVERED");
        return {
          status: "DELIVERED",
          messageId: envelope.messageId,
          responsePayload: delivery.responsePayload,
        };
      } else {
        this.logAudit(envelope, "REJECTED", delivery.error || "Destination rejected payload");
        return {
          status: "REJECTED",
          messageId: envelope.messageId,
          reason: delivery.error || "Destination gateway rejected envelope",
        };
      }
    } catch (err: any) {
      this.queueMessage(envelope);
      this.logAudit(envelope, "QUEUED", err.message || "Delivery execution failed");
      return {
        status: "QUEUED",
        messageId: envelope.messageId,
        reason: `DELIVERY_FAILED: ${err.message}`,
      };
    }
  }

  private queueMessage(envelope: MessageEnvelope): void {
    const queued: QueuedMessage = {
      envelope,
      attempts: 1,
      nextAttemptTime: Math.floor(Date.now() / 1000) + 2, // 2s initial backoff
      maxAttempts: 5,
    };
    this.queuedMessages.set(envelope.messageId, queued);
  }

  /**
   * Evaluates queued messages and attempts re-delivery if backoff time elapsed.
   */
  public async processRetries(force = false): Promise<{ retried: number; delivered: number }> {
    const now = Math.floor(Date.now() / 1000);
    let retried = 0;
    let delivered = 0;

    for (const [messageId, item] of Array.from(this.queuedMessages.entries())) {
      if (force || now >= item.nextAttemptTime) {
        retried++;
        const target = this.gateways.get(item.envelope.toInstitution.toLowerCase());

        if (target && target.isOnline()) {
          try {
            const res = await target.receiveMessage(item.envelope);
            if (res.success) {
              delivered++;
              this.queuedMessages.delete(messageId);
              this.logAudit(item.envelope, "DELIVERED", `Delivered after ${item.attempts} retry attempts`);
              continue;
            }
          } catch {
            // fall through to backoff
          }
        }

        // Increment retry attempts with exponential backoff
        item.attempts++;
        if (item.attempts > item.maxAttempts) {
          this.queuedMessages.delete(messageId);
          this.logAudit(item.envelope, "REJECTED", "Max retry attempts exceeded; message dropped");
        } else {
          item.nextAttemptTime = now + Math.pow(2, item.attempts); // 2, 4, 8, 16 seconds
        }
      }
    }

    return { retried, delivered };
  }

  public getQueueLength(): number {
    return this.queuedMessages.size;
  }

  public getAuditLogs(): HubAuditLogEntry[] {
    return [...this.transitLogs];
  }

  private logAudit(envelope: MessageEnvelope, status: "DELIVERED" | "QUEUED" | "REJECTED", reason?: string): void {
    this.transitLogs.unshift({
      messageId: envelope.messageId,
      type: envelope.type,
      fromInstitution: envelope.fromInstitution,
      toInstitution: envelope.toInstitution,
      globalPatientId: envelope.globalPatientId,
      status,
      timestamp: Math.floor(Date.now() / 1000),
      reason,
    });
  }
}
