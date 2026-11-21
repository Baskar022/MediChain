import { expect } from "chai";
import { ethers } from "ethers";
import {
  deriveEncryptionKeypairFromSignature,
  KEY_DERIVATION_MESSAGE,
  KEY_DERIVATION_DOCS,
} from "../keyDerivation";
import { wrapRecordKey, unwrapRecordKey } from "../ecies";

describe("Phase F-3: Deterministic Encryption Key Derivation", () => {
  let patientWallet: ethers.HDNodeWallet;

  beforeEach(() => {
    patientWallet = ethers.Wallet.createRandom();
  });

  it("should derive deterministic SECP256k1 keypair from signature", async () => {
    const signature = await patientWallet.signMessage(KEY_DERIVATION_MESSAGE);
    const keyPair1 = deriveEncryptionKeypairFromSignature(signature);
    const keyPair2 = deriveEncryptionKeypairFromSignature(signature);

    expect(keyPair1.privateKeyHex).to.equal(keyPair2.privateKeyHex);
    expect(keyPair1.publicKeyHex).to.equal(keyPair2.publicKeyHex);
    expect(keyPair1.publicKeyHex.length).to.be.oneOf([66, 130]);
  });

  it("should derive different keypairs for different wallets", async () => {
    const wallet2 = ethers.Wallet.createRandom();
    const sig1 = await patientWallet.signMessage(KEY_DERIVATION_MESSAGE);
    const sig2 = await wallet2.signMessage(KEY_DERIVATION_MESSAGE);

    const keyPair1 = deriveEncryptionKeypairFromSignature(sig1);
    const keyPair2 = deriveEncryptionKeypairFromSignature(sig2);

    expect(keyPair1.privateKeyHex).to.not.equal(keyPair2.privateKeyHex);
    expect(keyPair1.publicKeyHex).to.not.equal(keyPair2.publicKeyHex);
  });

  it("should successfully wrap and unwrap AES record keys using derived keypair", async () => {
    const signature = await patientWallet.signMessage(KEY_DERIVATION_MESSAGE);
    const keyPair = deriveEncryptionKeypairFromSignature(signature);

    const secretAesKey = ethers.randomBytes(32);
    const wrapped = wrapRecordKey(secretAesKey, keyPair.publicKeyHex);
    const unwrapped = unwrapRecordKey(wrapped, keyPair.privateKeyHex);

    expect(Buffer.from(unwrapped).toString("hex")).to.equal(Buffer.from(secretAesKey).toString("hex"));
  });

  it("should provide security documentation and limitations", () => {
    expect(KEY_DERIVATION_DOCS.standards).to.include("RFC 6979");
    expect(KEY_DERIVATION_DOCS.standards).to.include("RFC 5869");
    expect(KEY_DERIVATION_DOCS.limitations.length).to.be.greaterThan(2);
  });
});
