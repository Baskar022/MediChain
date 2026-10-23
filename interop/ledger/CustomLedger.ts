import * as crypto from "crypto";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

/**
 * Standard Merkle Tree implementation for the Custom Non-EVM Permissioned Ledger.
 * Provides authentic SHA-256 binary hash tree computation, proof generation,
 * and deterministic inclusion verification.
 */
export class MerkleTree {
  private leaves: string[];
  private layers: string[][];

  constructor(leaves: string[]) {
    // If empty leaves, provide a deterministic null leaf
    this.leaves = leaves.length > 0 ? leaves : [crypto.createHash("sha256").update("EMPTY_BLOCK").digest("hex")];
    this.layers = [this.leaves];
    this.buildTree();
  }

  private hashPair(a: string, b: string): string {
    // Sort pair to ensure deterministic Merkle path
    const combined = a < b ? a + b : b + a;
    return crypto.createHash("sha256").update(combined).digest("hex");
  }

  private buildTree(): void {
    let currentLayer = this.layers[0];
    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          nextLayer.push(this.hashPair(currentLayer[i], currentLayer[i + 1]));
        } else {
          // Odd leaf: pair with itself
          nextLayer.push(this.hashPair(currentLayer[i], currentLayer[i]));
        }
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): string {
    return this.layers[this.layers.length - 1][0];
  }

  public getProof(index: number): string[] {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Leaf index ${index} out of bounds (0-${this.leaves.length - 1})`);
    }

    const proof: string[] = [];
    let currentIndex = index;

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRightNode = currentIndex % 2 === 1;
      const pairIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (pairIndex < layer.length) {
        proof.push(layer[pairIndex]);
      } else {
        proof.push(layer[currentIndex]);
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  public static verifyProof(leaf: string, proof: string[], root: string): boolean {
    let current = leaf.startsWith("0x") ? leaf.slice(2) : leaf;
    const targetRoot = root.startsWith("0x") ? root.slice(2) : root;

    for (const sibling of proof) {
      const sib = sibling.startsWith("0x") ? sibling.slice(2) : sibling;
      const combined = current < sib ? current + sib : sib + current;
      current = crypto.createHash("sha256").update(combined).digest("hex");
    }

    return current.toLowerCase() === targetRoot.toLowerCase();
  }
}

export type TransactionType =
  | "TX_RECORD_REGISTER"
  | "TX_CONSENT_GRANT"
  | "TX_CONSENT_REVOKE"
  | "TX_EMERGENCY_OVERRIDE"
  | "TX_AUDIT_LOG";

export interface LedgerTransaction {
  txId: string;
  type: TransactionType;
  payload: Record<string, any>;
  timestamp: number;
  nonce: number;
  signature: string;
  senderPubKey: string;
}

export interface LedgerBlock {
  index: number;
  previousHash: string;
  timestamp: number;
  merkleRoot: string;
  transactions: LedgerTransaction[];
  blockHash: string;
  validator: string;
  signature: string;
}

export interface RecordState {
  recordId: string;
  patientIdHash: string;
  recordHash: string;
  cipherHash: string;
  recordType: string;
  issuerSignature: string;
  storageRef: string;
  blockNumber: number;
  blockHash: string;
  txIndex: number;
  registeredAt: number;
  isRevoked: boolean;
}

export interface ConsentState {
  consentId: string;
  patientIdHash: string;
  grantee: string;
  recordId: string;
  scope: string;
  validUntil: number;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  blockNumber: number;
  grantedAt: number;
}

export interface AuditState {
  auditId: string;
  recordId: string;
  patientIdHash: string;
  actor: string;
  action: string;
  details: string;
  timestamp: number;
  blockNumber: number;
}

/**
 * Custom Non-EVM Permissioned Ledger for Metro Diagnostics Lab (Network C).
 * Simulates a Hyperledger Fabric / Corda style enterprise permissioned ledger.
 */
export class CustomLedger {
  public readonly chainId = "METRO-LAB-CHAIN-C";
  public readonly name = "Metro Diagnostics Lab Permissioned Ledger";

  // Validator identity
  public readonly validatorKeypair: { privateKey: string; publicKey: string };

  // Chain state
  private blocks: LedgerBlock[] = [];
  private pendingTransactions: LedgerTransaction[] = [];
  private records: Map<string, RecordState> = new Map();
  private consents: Map<string, ConsentState> = new Map();
  private audits: AuditState[] = [];
  private listeners: ((event: any) => void)[] = [];
  private persistencePath?: string;
  private autoPersist: boolean = false;

  constructor(config?: { persistencePath?: string; autoPersist?: boolean }) {
    // Generate EC Keypair (secp256k1) for ledger validator
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "secp256k1",
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    this.validatorKeypair = { privateKey, publicKey };

    this.autoPersist = config?.autoPersist ?? (process.env.PERSIST_LEDGER === "true");
    if (config?.persistencePath) {
      this.persistencePath = config.persistencePath;
    } else if (this.autoPersist) {
      const storageDir = path.resolve(process.cwd(), process.cwd().endsWith("interop") ? "../storage" : "storage");
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      this.persistencePath = path.join(storageDir, "ledger-network-c.json");
    }

    // Load from disk if exists, else mint Genesis Block
    if (this.persistencePath && fs.existsSync(this.persistencePath)) {
      this.loadFromFile();
    } else {
      this.mintGenesisBlock();
      if (this.persistencePath) {
        this.saveToFile();
      }
    }
  }

  public saveToFile(): void {
    if (!this.persistencePath) return;
    try {
      const data = {
        blocks: this.blocks,
        records: Array.from(this.records.entries()),
        consents: Array.from(this.consents.entries()),
        audits: this.audits,
        updatedAt: Date.now(),
      };
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e: any) {
      console.warn(`[LEDGER] Failed to persist state to ${this.persistencePath}:`, e.message);
    }
  }

  public loadFromFile(): void {
    if (!this.persistencePath || !fs.existsSync(this.persistencePath)) return;
    try {
      const content = fs.readFileSync(this.persistencePath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        this.blocks = parsed.blocks;
        this.records = new Map(parsed.records || []);
        this.consents = new Map(parsed.consents || []);
        this.audits = parsed.audits || [];
      } else {
        this.mintGenesisBlock();
      }
    } catch {
      this.mintGenesisBlock();
    }
  }

  private mintGenesisBlock(): void {
    const genesisTxs: LedgerTransaction[] = [
      {
        txId: "tx_genesis_000000000000000000000000",
        type: "TX_AUDIT_LOG",
        payload: { message: "Genesis Block Initialized for Metro Diagnostics Lab Ledger" },
        timestamp: 1704067200000,
        nonce: 0,
        signature: "genesis_sig",
        senderPubKey: "genesis_pubkey",
      },
    ];

    const leaf = crypto.createHash("sha256").update(JSON.stringify(genesisTxs[0])).digest("hex");
    const merkleTree = new MerkleTree([leaf]);
    const merkleRoot = merkleTree.getRoot();

    const blockData = {
      index: 0,
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      timestamp: 1704067200000,
      merkleRoot,
    };

    const blockHash = crypto.createHash("sha256").update(JSON.stringify(blockData)).digest("hex");

    const sign = crypto.createSign("SHA256");
    sign.update(blockHash);
    const signature = sign.sign(this.validatorKeypair.privateKey, "hex");

    const genesisBlock: LedgerBlock = {
      ...blockData,
      transactions: genesisTxs,
      blockHash,
      validator: "METRO_LAB_AUTHORITY",
      signature,
    };

    this.blocks.push(genesisBlock);
  }

  public getBlockHeight(): number {
    return this.blocks.length - 1;
  }

  public getLatestBlock(): LedgerBlock {
    return this.blocks[this.blocks.length - 1];
  }

  public getBlock(index: number): LedgerBlock | undefined {
    return this.blocks[index];
  }

  public getAllBlocks(): LedgerBlock[] {
    return [...this.blocks];
  }

  /**
   * Commits a new transaction and immediately mints an append-only block.
   */
  public submitTransaction(
    type: TransactionType,
    payload: Record<string, any>,
    senderPubKey?: string
  ): { txId: string; blockNumber: number; blockHash: string } {
    const now = Date.now();
    const txId = "tx_" + crypto.randomBytes(16).toString("hex");

    // Sign transaction with validator or provided sender
    const txContent = JSON.stringify({ txId, type, payload, timestamp: now, nonce: now });
    const sign = crypto.createSign("SHA256");
    sign.update(txContent);
    const signature = sign.sign(this.validatorKeypair.privateKey, "hex");

    const tx: LedgerTransaction = {
      txId,
      type,
      payload,
      timestamp: now,
      nonce: now,
      signature,
      senderPubKey: senderPubKey || this.validatorKeypair.publicKey,
    };

    // Apply state transitions
    this.applyTransaction(tx, this.blocks.length, 0);

    // Mint block immediately for deterministic testability
    const prevBlock = this.getLatestBlock();
    const leaf = crypto.createHash("sha256").update(JSON.stringify(tx)).digest("hex");
    const tree = new MerkleTree([leaf]);
    const merkleRoot = tree.getRoot();

    const blockNumber = this.blocks.length;
    const blockHeader = {
      index: blockNumber,
      previousHash: prevBlock.blockHash,
      timestamp: now,
      merkleRoot,
    };

    const blockHash = crypto.createHash("sha256").update(JSON.stringify(blockHeader)).digest("hex");

    const blockSign = crypto.createSign("SHA256");
    blockSign.update(blockHash);
    const blockSignature = blockSign.sign(this.validatorKeypair.privateKey, "hex");

    const newBlock: LedgerBlock = {
      ...blockHeader,
      transactions: [tx],
      blockHash,
      validator: "METRO_LAB_AUTHORITY",
      signature: blockSignature,
    };

    this.blocks.push(newBlock);
    this.saveToFile();

    // Notify subscribers
    this.emitEvent({
      eventName: type,
      data: payload,
      blockNumber,
      txHash: txId,
    });

    return {
      txId,
      blockNumber,
      blockHash,
    };
  }

  private applyTransaction(tx: LedgerTransaction, blockNumber: number, txIndex: number): void {
    const { type, payload } = tx;

    switch (type) {
      case "TX_RECORD_REGISTER": {
        const recordState: RecordState = {
          recordId: payload.recordId,
          patientIdHash: payload.patientIdHash,
          recordHash: payload.recordHash,
          cipherHash: payload.cipherHash,
          recordType: payload.recordType,
          issuerSignature: payload.issuerSignature,
          storageRef: payload.storageRef,
          blockNumber,
          blockHash: "",
          txIndex,
          registeredAt: tx.timestamp,
          isRevoked: false,
        };
        this.records.set(payload.recordId, recordState);
        break;
      }

      case "TX_CONSENT_GRANT": {
        const consentState: ConsentState = {
          consentId: payload.consentId,
          patientIdHash: payload.patientIdHash,
          grantee: payload.grantee,
          recordId: payload.recordId,
          scope: payload.scope,
          validUntil: payload.validUntil,
          status: "ACTIVE",
          blockNumber,
          grantedAt: tx.timestamp,
        };
        this.consents.set(payload.consentId, consentState);
        break;
      }

      case "TX_CONSENT_REVOKE": {
        const existing = this.consents.get(payload.consentId);
        if (existing) {
          existing.status = "REVOKED";
        }
        break;
      }

      case "TX_AUDIT_LOG": {
        this.audits.push({
          auditId: tx.txId,
          recordId: payload.recordId,
          patientIdHash: payload.patientIdHash,
          actor: payload.actor,
          action: payload.action,
          details: payload.details,
          timestamp: tx.timestamp,
          blockNumber,
        });
        break;
      }
    }
  }

  public getRecord(recordId: string): RecordState | undefined {
    return this.records.get(recordId);
  }

  public getRecordInclusionProof(recordId: string): {
    recordId: string;
    recordHash: string;
    cipherHash: string;
    blockNumber: number;
    blockHash: string;
    merkleProof: string[];
    rootHash: string;
  } {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found on Metro Lab Ledger`);
    }

    const block = this.blocks[record.blockNumber];
    if (!block) {
      throw new Error(`Block ${record.blockNumber} not found`);
    }

    // Build leaves for all transactions in this block
    const leaves = block.transactions.map((tx) =>
      crypto.createHash("sha256").update(JSON.stringify(tx)).digest("hex")
    );

    const tree = new MerkleTree(leaves);
    const proof = tree.getProof(record.txIndex);

    return {
      recordId: record.recordId,
      recordHash: record.recordHash,
      cipherHash: record.cipherHash,
      blockNumber: record.blockNumber,
      blockHash: block.blockHash,
      merkleProof: proof,
      rootHash: block.merkleRoot,
    };
  }

  public checkConsent(
    patientIdHash: string,
    grantee: string,
    recordId: string
  ): { hasAccess: boolean; isEmergency: boolean; reason: string; validUntil?: number } {
    const now = Math.floor(Date.now() / 1000);

    for (const consent of this.consents.values()) {
      if (
        consent.patientIdHash.toLowerCase() === patientIdHash.toLowerCase() &&
        consent.grantee.toLowerCase() === grantee.toLowerCase() &&
        consent.status === "ACTIVE"
      ) {
        if (consent.validUntil <= now) {
          consent.status = "EXPIRED";
          continue;
        }

        // Check scope: specific recordId, category matching, or ALL_RECORDS
        const rec = this.records.get(recordId);
        const matchesCategory =
          rec &&
          (rec.recordType.toUpperCase() === consent.recordId.toUpperCase() ||
            rec.recordType.toUpperCase() === consent.scope.toUpperCase());

        if (
          consent.scope === "ALL_RECORDS" ||
          consent.recordId === recordId ||
          consent.recordId === "0x0000000000000000000000000000000000000000000000000000000000000000" ||
          matchesCategory
        ) {
          return {
            hasAccess: true,
            isEmergency: false,
            reason: `Valid active consent ${consent.consentId}`,
            validUntil: consent.validUntil,
          };
        }
      }
    }

    return {
      hasAccess: false,
      isEmergency: false,
      reason: "No active consent found on Metro Lab Ledger",
    };
  }

  public revokeConsent(consentId: string): void {
    const existing = this.consents.get(consentId);
    if (!existing) {
      throw new Error(`Consent ${consentId} not found`);
    }
    this.submitTransaction("TX_CONSENT_REVOKE", { consentId, patientIdHash: existing.patientIdHash });
  }

  public subscribe(callback: (event: any) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private emitEvent(event: any): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  /**
   * Starts a standalone HTTP REST API server on port 9000 for Network C.
   */
  public startHttpServer(port = 9000): http.Server {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const method = req.method;

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      // Route: GET /status or /api/chain/info
      if (method === "GET" && (url.pathname === "/status" || url.pathname === "/api/chain/info")) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            chainId: this.chainId,
            name: this.name,
            chainType: "PERMISSIONED_LEDGER",
            height: this.getBlockHeight(),
            latestBlockHash: this.getLatestBlock().blockHash,
            latestBlock: {
              blockNumber: this.getBlockHeight(),
              hash: this.getLatestBlock().blockHash,
              timestamp: this.getLatestBlock().timestamp,
            },
          })
        );
        return;
      }

      // Route: GET /blocks or /api/blocks
      if (method === "GET" && (url.pathname === "/blocks" || url.pathname === "/api/blocks")) {
        const blocks = this.getAllBlocks();
        res.statusCode = 200;
        res.end(JSON.stringify({ blocks, height: blocks.length }));
        return;
      }

      // Route: GET /records/:id
      if (method === "GET" && url.pathname.startsWith("/records/")) {
        const parts = url.pathname.split("/");
        const recordId = parts[2];
        const isProof = parts[3] === "proof";

        if (isProof) {
          try {
            const proof = this.getRecordInclusionProof(recordId);
            res.statusCode = 200;
            res.end(JSON.stringify(proof));
          } catch (err: any) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        const record = this.getRecord(recordId);
        if (record) {
          res.statusCode = 200;
          res.end(JSON.stringify(record));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Record not found" }));
        }
        return;
      }

      // Route: POST /transactions
      if (method === "POST" && url.pathname === "/transactions") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const result = this.submitTransaction(parsed.type, parsed.payload, parsed.senderPubKey);
            res.statusCode = 201;
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Route: POST /consents/check
      if (method === "POST" && url.pathname === "/consents/check") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const { patientIdHash, grantee, recordId } = JSON.parse(body);
            const result = this.checkConsent(patientIdHash, grantee, recordId);
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // Fallback 404
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Endpoint not found" }));
    });

    server.listen(port);
    return server;
  }
}
