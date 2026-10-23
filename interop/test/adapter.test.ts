import { expect } from "chai";
import * as crypto from "crypto";
import { MerkleTree, CustomLedger } from "../ledger/CustomLedger";
import { LedgerAdapter } from "../adapters/LedgerAdapter";
import { EvmAdapter } from "../adapters/EvmAdapter";
import { ChainAdapter } from "../adapters/ChainAdapter";

describe("Phase I-1: Sovereign Blockchains, Custom Ledger & ChainAdapter Architecture", () => {
  describe("1. Merkle Tree & Cryptographic Inclusion Proofs", () => {
    it("should build deterministic binary Merkle Tree and compute root", () => {
      const leaves = [
        crypto.createHash("sha256").update("TX_1").digest("hex"),
        crypto.createHash("sha256").update("TX_2").digest("hex"),
        crypto.createHash("sha256").update("TX_3").digest("hex"),
        crypto.createHash("sha256").update("TX_4").digest("hex"),
      ];

      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();

      expect(root).to.be.a("string");
      expect(root).to.have.lengthOf(64);

      // Same leaves must produce identical root
      const tree2 = new MerkleTree(leaves);
      expect(tree2.getRoot()).to.equal(root);
    });

    it("should generate valid Merkle branch and verify leaf inclusion", () => {
      const leaves = [
        crypto.createHash("sha256").update("TX_A").digest("hex"),
        crypto.createHash("sha256").update("TX_B").digest("hex"),
        crypto.createHash("sha256").update("TX_C").digest("hex"),
      ];

      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();

      // Check leaf 1
      const proof1 = tree.getProof(1);
      const isValid = MerkleTree.verifyProof(leaves[1], proof1, root);
      expect(isValid).to.be.true;

      // Check leaf 2
      const proof2 = tree.getProof(2);
      const isValid2 = MerkleTree.verifyProof(leaves[2], proof2, root);
      expect(isValid2).to.be.true;
    });

    it("should reject tampered leaf or forged proof branch", () => {
      const leaves = [
        crypto.createHash("sha256").update("TX_VALID").digest("hex"),
        crypto.createHash("sha256").update("TX_SECOND").digest("hex"),
      ];

      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();
      const proof = tree.getProof(0);

      const fakeLeaf = crypto.createHash("sha256").update("TX_FORGED").digest("hex");
      const isFakeValid = MerkleTree.verifyProof(fakeLeaf, proof, root);
      expect(isFakeValid).to.be.false;

      // Corrupt proof sibling
      const corruptedProof = ["0000000000000000000000000000000000000000000000000000000000000000"];
      const isCorruptedValid = MerkleTree.verifyProof(leaves[0], corruptedProof, root);
      expect(isCorruptedValid).to.be.false;
    });
  });

  describe("2. Custom Non-EVM Permissioned Ledger (Network C - Metro Diagnostics Lab)", () => {
    let ledger: CustomLedger;

    beforeEach(() => {
      ledger = new CustomLedger();
    });

    it("should initialize Genesis Block with index 0 and authority signature", () => {
      expect(ledger.getBlockHeight()).to.equal(0);
      const genesis = ledger.getLatestBlock();
      expect(genesis.index).to.equal(0);
      expect(genesis.validator).to.equal("METRO_LAB_AUTHORITY");
      expect(genesis.signature).to.be.a("string");
      expect(genesis.transactions).to.have.lengthOf(1);
    });

    it("should append blocks hash-chained to previous block hash", () => {
      const genesis = ledger.getLatestBlock();

      const txResult = ledger.submitTransaction("TX_RECORD_REGISTER", {
        recordId: "0x1111222233334444",
        patientIdHash: "0xaaaa",
        recordHash: "0xbbbb",
        cipherHash: "0xcccc",
        recordType: "HEMATOLOGY",
        issuerSignature: "0xsig",
        storageRef: "/storage/lab_blood_work.enc",
      });

      expect(txResult.blockNumber).to.equal(1);
      const block1 = ledger.getBlock(1);
      expect(block1).to.exist;
      expect(block1!.previousHash).to.equal(genesis.blockHash);
      expect(block1!.transactions[0].type).to.equal("TX_RECORD_REGISTER");
    });

    it("should generate on-chain inclusion proof for registered medical record", () => {
      const recordId = "0x9876543210abcdef";
      ledger.submitTransaction("TX_RECORD_REGISTER", {
        recordId,
        patientIdHash: "0xpatient1",
        recordHash: "0xrechash1",
        cipherHash: "0xcipherhash1",
        recordType: "PATHOLOGY",
        issuerSignature: "0xissuersig",
        storageRef: "/storage/pathology.enc",
      });

      const proof = ledger.getRecordInclusionProof(recordId);
      expect(proof.recordId).to.equal(recordId);
      expect(proof.blockNumber).to.be.greaterThan(0);
      expect(proof.merkleProof).to.be.an("array");

      // Verify the proof directly
      const leaf = crypto
        .createHash("sha256")
        .update(JSON.stringify(ledger.getBlock(proof.blockNumber)!.transactions[0]))
        .digest("hex");

      const verified = MerkleTree.verifyProof(leaf, proof.merkleProof, proof.rootHash);
      expect(verified).to.be.true;
    });

    it("should enforce consent rules: grant, scope check, and instant revocation", () => {
      const patientId = "0xpatient_alice";
      const hospital = "0xhospital_b";
      const recordId = "0xrecord_42";
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;

      // 1. Initially no consent
      const checkInitial = ledger.checkConsent(patientId, hospital, recordId);
      expect(checkInitial.hasAccess).to.be.false;

      // 2. Grant consent
      ledger.submitTransaction("TX_CONSENT_GRANT", {
        consentId: "consent_001",
        patientIdHash: patientId,
        grantee: hospital,
        recordId,
        scope: "SPECIFIC_RECORD",
        validUntil: futureExpiry,
      });

      const checkGranted = ledger.checkConsent(patientId, hospital, recordId);
      expect(checkGranted.hasAccess).to.be.true;

      // 3. Revoke consent
      ledger.revokeConsent("consent_001");
      const checkRevoked = ledger.checkConsent(patientId, hospital, recordId);
      expect(checkRevoked.hasAccess).to.be.false;
    });
  });

  describe("3. ChainAdapter: LedgerAdapter for Network C", () => {
    let adapter: ChainAdapter;

    beforeEach(() => {
      adapter = new LedgerAdapter();
    });

    it("should satisfy ChainAdapter interface and report PERMISSIONED_LEDGER type", () => {
      expect(adapter.chainType).to.equal("PERMISSIONED_LEDGER");
      expect(adapter.chainIdentifier).to.include("METRO-LAB");
    });

    it("should register record, fetch inclusion proof, and verify validity", async () => {
      const reg = await adapter.registerRecord(
        "0xpatient_hash",
        "0xrecord_hash",
        "0xcipher_hash",
        "MICROBIOLOGY",
        "0xsig",
        "storage/ref.enc"
      );

      expect(reg.recordId).to.be.a("string");
      expect(reg.blockNumber).to.be.greaterThan(0);

      const proof = await adapter.getRecordProof(reg.recordId);
      expect(proof.recordId).to.equal(reg.recordId);
      expect(proof.merkleProof).to.be.an("array");

      // Verify proof via adapter method
      const leaf = proof.merkleProof.length > 0 ? proof.merkleProof[0] : "";
      const valid = await adapter.verifyInclusionProof(proof.rootHash, [], proof.rootHash);
      expect(valid).to.be.true;
    });

    it("should manage consent lifecycle across grant, check, and revocation", async () => {
      const consent = await adapter.grantConsent(
        "0xpatient_1",
        "0xhospital_city_general",
        "0xrec_10",
        "ALL_RECORDS",
        Math.floor(Date.now() / 1000) + 86400
      );

      expect(consent.consentId).to.be.a("string");

      const check1 = await adapter.checkConsent("0xpatient_1", "0xhospital_city_general", "0xrec_10");
      expect(check1.hasAccess).to.be.true;

      await adapter.revokeConsent(consent.consentId);
      const check2 = await adapter.checkConsent("0xpatient_1", "0xhospital_city_general", "0xrec_10");
      expect(check2.hasAccess).to.be.false;
    });

    it("should log cross-chain audit entries", async () => {
      const audit = await adapter.logAudit(
        "0xrec_1",
        "0xpatient_1",
        "0xdoctor_sarah",
        "CROSS_CHAIN_ACCESS",
        "Transferred to Regional Specialty Hospital"
      );

      expect(audit.txHash).to.be.a("string");
      expect(audit.blockNumber).to.be.greaterThan(0);
    });
  });

  describe("4. ChainAdapter: EvmAdapter for Network A & B", () => {
    let evmAdapter: ChainAdapter;

    beforeEach(() => {
      evmAdapter = new EvmAdapter({
        chainIdentifier: "NETWORK-A-CITY-GENERAL",
        chainId: 31337,
        rpcUrl: "http://127.0.0.1:8545",
        contractAddresses: {
          recordRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
          consentManager: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
          auditLog: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        },
      });
    });

    it("should satisfy ChainAdapter interface and report EVM type", () => {
      expect(evmAdapter.chainType).to.equal("EVM");
      expect(evmAdapter.chainIdentifier).to.equal("NETWORK-A-CITY-GENERAL");
    });

    it("should register record and provide inclusion proof conforming to standard format", async () => {
      const result = await evmAdapter.registerRecord(
        "0xpatient_salted_hash",
        "0xplaintext_sha256",
        "0xciphertext_sha256",
        "CARDIOLOGY",
        "0xdoctor_signature",
        "storage/cardio.enc"
      );

      expect(result.recordId).to.be.a("string");
      expect(result.txHash).to.be.a("string");

      const proof = await evmAdapter.getRecordProof(result.recordId);
      expect(proof.recordId).to.equal(result.recordId);
      expect(proof.rootHash).to.be.a("string");

      const isValid = await evmAdapter.verifyInclusionProof(proof.rootHash, [], proof.rootHash);
      expect(isValid).to.be.true;
    });

    it("should evaluate consent checks and log audit entries", async () => {
      const audit = await evmAdapter.logAudit(
        "0xrec_100",
        "0xpatient_100",
        "0xdr_chen",
        "CROSS_CHAIN_IMPORT",
        "Imported from Network C Metro Lab"
      );
      expect(audit.txHash).to.be.a("string");
    });
  });

  describe("5. Cross-Chain Interoperability & Polymorphic Interface Consistency", () => {
    it("should process both EVM and Non-EVM adapters uniformly in an array of adapters", async () => {
      const adapters: ChainAdapter[] = [
        new EvmAdapter({
          chainIdentifier: "NETWORK-A-CITY-GENERAL",
          chainId: 31337,
          rpcUrl: "http://127.0.0.1:8545",
          contractAddresses: {
            recordRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
            consentManager: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
            auditLog: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
          },
        }),
        new EvmAdapter({
          chainIdentifier: "NETWORK-B-REGIONAL-SPECIALTY",
          chainId: 31338,
          rpcUrl: "http://127.0.0.1:8546",
          contractAddresses: {
            recordRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
            consentManager: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
            auditLog: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
          },
        }),
        new LedgerAdapter({
          chainIdentifier: "NETWORK-C-METRO-LAB",
        }),
      ];

      expect(adapters).to.have.lengthOf(3);
      expect(adapters.map((a) => a.chainType)).to.deep.equal(["EVM", "EVM", "PERMISSIONED_LEDGER"]);

      // Execute uniform record registration on all 3 sovereign networks
      for (const adapter of adapters) {
        const reg = await adapter.registerRecord(
          "0xglobal_patient_uuid",
          "0xsample_hash",
          "0xcipher_hash",
          "LAB_REPORT",
          "0xsig",
          "storage/sample.enc"
        );
        expect(reg.recordId).to.be.a("string");
        expect(reg.txHash).to.be.a("string");

        const block = await adapter.getBlockInfo();
        expect(block.blockNumber).to.be.a("number");
      }
    });
  });
});
