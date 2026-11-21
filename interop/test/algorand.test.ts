import { expect } from "chai";
import { AlgorandAdapter } from "../adapters/AlgorandAdapter";
import algosdk from "algosdk";
import * as crypto from "crypto";

describe("Phase F-1: AlgorandAdapter & AVM Sovereign Lab Integration", () => {
  let adapter: AlgorandAdapter;

  before(() => {
    // Generate deterministic test account for test harness
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest";

    adapter = new AlgorandAdapter({
      algodUrl: "https://testnet-api.algonode.cloud",
      algodPort: 443,
      algodToken: "",
      appId: 12345678,
      relayerMnemonic: mnemonic,
    });
  });

  it("should implement ChainAdapter interface with ALGORAND classification", () => {
    expect(adapter.chainType).to.equal("ALGORAND");
    expect(adapter.chainIdentifier).to.equal("ALGORAND_TESTNET");
  });

  it("should perform live health check against Algorand TestNet (or gracefully handle timeout)", async function () {
    this.timeout(10000);
    const health = await adapter.healthCheck();
    expect(health).to.have.property("online");
    expect(health).to.have.property("latencyMs");
    expect(health.chainIdOrGenesis).to.include("testnet");
    if (health.online) {
      expect(health.blockHeight).to.be.greaterThan(0);
    }
  });

  it("should format and verify Merkle inclusion proof for Algorand rounds", async () => {
    const leaf = "0x" + "a".repeat(64);
    const proof = ["0x" + "b".repeat(64), "0x" + "c".repeat(64)];

    // Calculate expected root
    let current = leaf.slice(2).toLowerCase();
    for (const p of proof) {
      const sibling = p.slice(2).toLowerCase();
      const combined = current < sibling ? current + sibling : sibling + current;
      current = crypto.createHash("sha256").update(Buffer.from(combined, "hex")).digest("hex");
    }
    const expectedRoot = "0x" + current;

    const isValid = await adapter.verifyInclusionProof(leaf, proof, expectedRoot);
    expect(isValid).to.be.true;

    const isInvalid = await adapter.verifyInclusionProof(leaf, proof, "0x" + "0".repeat(64));
    expect(isInvalid).to.be.false;
  });

  it("should allow event subscription and unsubscription", () => {
    const events: any[] = [];
    const unsubscribe = adapter.subscribeEvents((evt) => {
      events.push(evt);
    });
    expect(typeof unsubscribe).to.equal("function");
    unsubscribe();
  });
});
