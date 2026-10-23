import {
  ChainAdapter,
  BlockInfo,
  RecordRegistrationResult,
  RecordInclusionProof,
  ConsentResult,
  ConsentCheckResult,
  AuditLogResult,
  ChainEvent,
} from "./ChainAdapter";
import { CustomLedger, MerkleTree } from "../ledger/CustomLedger";
import * as crypto from "crypto";

export interface LedgerAdapterConfig {
  chainIdentifier?: string;
  ledgerInstance?: CustomLedger;
  restEndpoint?: string;
}

/**
 * LedgerAdapter
 * Implements the ChainAdapter interface for the custom Non-EVM Permissioned Ledger (Network C).
 */
export class LedgerAdapter implements ChainAdapter {
  public readonly chainIdentifier: string;
  public readonly chainType = "PERMISSIONED_LEDGER" as const;

  private ledger: CustomLedger;
  private restEndpoint?: string;

  constructor(config?: LedgerAdapterConfig) {
    this.chainIdentifier = config?.chainIdentifier || "NETWORK-C-METRO-LAB";
    this.ledger = config?.ledgerInstance || new CustomLedger();
    this.restEndpoint = config?.restEndpoint;
  }

  public async registerRecord(
    patientIdHash: string,
    recordHash: string,
    cipherHash: string,
    recordType: string,
    issuerSignature: string,
    storageRef: string
  ): Promise<RecordRegistrationResult> {
    const recordId = "0x" + crypto.createHash("sha256").update(patientIdHash + recordHash + Date.now()).digest("hex");

    const result = this.ledger.submitTransaction("TX_RECORD_REGISTER", {
      recordId,
      patientIdHash,
      recordHash,
      cipherHash,
      recordType,
      issuerSignature,
      storageRef,
    });

    return {
      recordId,
      txHash: result.txId,
      blockNumber: result.blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  public async getRecordProof(recordId: string): Promise<RecordInclusionProof> {
    const proof = this.ledger.getRecordInclusionProof(recordId);
    return {
      recordId: proof.recordId,
      recordHash: proof.recordHash,
      cipherHash: proof.cipherHash,
      blockNumber: proof.blockNumber,
      blockHash: proof.blockHash,
      merkleProof: proof.merkleProof,
      rootHash: proof.rootHash,
    };
  }

  public async grantConsent(
    patientIdHash: string,
    grantee: string,
    recordId: string,
    scope: string,
    validUntil: number
  ): Promise<ConsentResult> {
    const consentId = "consent_" + crypto.randomBytes(12).toString("hex");

    const result = this.ledger.submitTransaction("TX_CONSENT_GRANT", {
      consentId,
      patientIdHash,
      grantee,
      recordId,
      scope,
      validUntil,
    });

    return {
      consentId,
      txHash: result.txId,
      blockNumber: result.blockNumber,
    };
  }

  public async revokeConsent(consentId: string): Promise<{ txHash: string }> {
    this.ledger.revokeConsent(consentId);
    const latest = this.ledger.getLatestBlock();
    return {
      txHash: latest.transactions[0]?.txId || "tx_revoke",
    };
  }

  public async checkConsent(
    patientIdHash: string,
    grantee: string,
    recordId: string
  ): Promise<ConsentCheckResult> {
    const result = this.ledger.checkConsent(patientIdHash, grantee, recordId);
    return {
      hasAccess: result.hasAccess,
      isEmergency: result.isEmergency,
      reason: result.reason,
      validUntil: result.validUntil,
    };
  }

  public async logAudit(
    recordId: string,
    patientIdHash: string,
    actor: string,
    action: string,
    details: string
  ): Promise<AuditLogResult> {
    const result = this.ledger.submitTransaction("TX_AUDIT_LOG", {
      recordId,
      patientIdHash,
      actor,
      action,
      details,
    });

    return {
      txHash: result.txId,
      blockNumber: result.blockNumber,
    };
  }

  public async getBlockInfo(blockNumber?: number): Promise<BlockInfo> {
    const block =
      blockNumber !== undefined ? this.ledger.getBlock(blockNumber) : this.ledger.getLatestBlock();

    if (!block) {
      throw new Error(`Block ${blockNumber} not found on custom ledger`);
    }

    return {
      blockNumber: block.index,
      blockHash: block.blockHash,
      timestamp: Math.floor(block.timestamp / 1000),
    };
  }

  public async verifyInclusionProof(
    leaf: string,
    proof: string[],
    rootHash: string
  ): Promise<boolean> {
    return MerkleTree.verifyProof(leaf, proof, rootHash);
  }

  public subscribeEvents(callback: (event: ChainEvent) => void): () => void {
    return this.ledger.subscribe(callback);
  }
}
