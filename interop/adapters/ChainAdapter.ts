/**
 * Technology-Agnostic ChainAdapter Interface
 * 
 * Defines the unified contract that any sovereign blockchain adapter
 * (Ethereum Sepolia, Polygon Amoy, Algorand TestNet, Hyperledger Fabric)
 * must implement to participate in the cross-chain interoperability network.
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
  txId?: string;
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

export interface HealthCheckResult {
  online: boolean;
  blockHeight: number;
  chainIdOrGenesis: string;
  latencyMs: number;
}

export interface ChainAdapter {
  /**
   * Unique identifier of this chain adapter instance (e.g. "ETHEREUM_SEPOLIA", "POLYGON_AMOY", "ALGORAND_TESTNET")
   */
  readonly chainIdentifier: string;

  /**
   * Chain classification
   */
  readonly chainType: "EVM" | "ALGORAND" | "FABRIC" | "PERMISSIONED_LEDGER";

  /**
   * Registers a newly issued medical record anchor on the local sovereign chain.
   */
  registerRecord(
    patientIdHash: string,
    recordHash: string,
    cipherHash: string,
    recordType: string,
    issuerSignature: string,
    storageRef: string // IPFS CID or local storage URI
  ): Promise<RecordRegistrationResult>;

  /**
   * Registers a verified cross-chain foreign record reference on the destination chain.
   */
  registerForeignProof(
    recordId: string,
    sourceChain: string,
    sourceInstitution: string,
    recordHash: string,
    cipherHash: string,
    storageRef: string,
    attestationSignature: string
  ): Promise<RecordRegistrationResult>;

  /**
   * Retrieves the cryptographic inclusion proof (Merkle branch & block header / tx receipt)
   * proving that a record exists on this chain at a specific block height / round.
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
   * Retrieves current block header / round information.
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

  /**
   * Evaluates network connectivity and latency.
   */
  healthCheck(): Promise<HealthCheckResult>;
}
