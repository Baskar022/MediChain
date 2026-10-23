/**
 * ChainAdapter Interface
 * Defines the unified, technology-agnostic interface that any underlying blockchain
 * (EVM Hardhat, Ethereum Sepolia, Custom Hash-Chained Ledger, Hyperledger Fabric)
 * must implement to participate in the MediChain Cross-Chain Interoperability Network.
 */

export interface BlockInfo {
  blockNumber: number;
  blockHash: string;
  timestamp: number;
}

export interface RecordRegistrationResult {
  recordId: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface RecordInclusionProof {
  recordId: string;
  recordHash: string;
  cipherHash: string;
  blockNumber: number;
  blockHash: string;
  merkleProof: string[];
  rootHash: string;
}

export interface ConsentResult {
  consentId: string;
  txHash: string;
  blockNumber: number;
}

export interface ConsentCheckResult {
  hasAccess: boolean;
  isEmergency: boolean;
  reason: string;
  validUntil?: number;
}

export interface AuditLogResult {
  txHash: string;
  blockNumber: number;
}

export interface ChainEvent {
  eventName: string;
  data: Record<string, any>;
  blockNumber: number;
  txHash: string;
}

export interface ChainAdapter {
  /**
   * Unique identifier of this chain adapter instance (e.g. "EVM-NETWORK-A", "LEDGER-NETWORK-C")
   */
  readonly chainIdentifier: string;

  /**
   * Chain classification: "EVM" or "PERMISSIONED_LEDGER"
   */
  readonly chainType: "EVM" | "PERMISSIONED_LEDGER";

  /**
   * Registers a newly issued medical record anchor on the local sovereign chain.
   */
  registerRecord(
    patientIdHash: string,
    recordHash: string,
    cipherHash: string,
    recordType: string,
    issuerSignature: string,
    storageRef: string
  ): Promise<RecordRegistrationResult>;

  /**
   * Retrieves the cryptographic inclusion proof (Merkle branch & block header)
   * proving that a record exists on this chain at a specific block height.
   */
  getRecordProof(recordId: string): Promise<RecordInclusionProof>;

  /**
   * Grants consent for an external hospital / practitioner on this chain.
   */
  grantConsent(
    patientIdHash: string,
    grantee: string,
    recordId: string,
    scope: string,
    validUntil: number
  ): Promise<ConsentResult>;

  /**
   * Instantly revokes an active consent grant on this chain.
   */
  revokeConsent(consentId: string): Promise<{ txHash: string }>;

  /**
   * Evaluates whether a grantee hospital currently holds valid consent for a record.
   */
  checkConsent(
    patientIdHash: string,
    grantee: string,
    recordId: string
  ): Promise<ConsentCheckResult>;

  /**
   * Appends an immutable audit entry to this chain's event log.
   */
  logAudit(
    recordId: string,
    patientIdHash: string,
    actor: string,
    action: string,
    details: string
  ): Promise<AuditLogResult>;

  /**
   * Retrieves block header information.
   */
  getBlockInfo(blockNumber?: number): Promise<BlockInfo>;

  /**
   * Verifies an inclusion Merkle proof against a known root hash.
   */
  verifyInclusionProof(
    leaf: string,
    proof: string[],
    rootHash: string
  ): Promise<boolean>;

  /**
   * Subscribes to on-chain events emitted by this chain.
   */
  subscribeEvents(callback: (event: ChainEvent) => void): () => void;
}
