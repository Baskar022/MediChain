import { expect } from "chai";
import { ethers } from "ethers";
import {
  generateRecordKey,
  encryptRecord,
  decryptRecord,
  decryptRecordToText,
  computeSha256,
  hashPatientId,
  secureHashCompare,
  generateHospitalEncryptionKeyPair,
  derivePublicKeyFromPrivate,
  wrapRecordKey,
  unwrapRecordKey,
  wrapRecordKeyForRecipients,
  signRecordHash,
  verifyRecordSignature,
  recoverSignerAddress,
} from "../index";

describe("Phase 2: MediChain Cryptography Layer", function () {
  describe("1. AES-256-GCM Authenticated Encryption", function () {
    const medicalReport = JSON.stringify({
      diagnosis: "Acute appendicitis with localized peritonitis",
      prescriptions: ["Cefazolin 1g IV q8h", "Metronidazole 500mg IV q8h"],
      labResults: { WBC: "16.4 x10^3/uL", CRP: "84 mg/L" },
      notes: "Prepared for emergency laparoscopic appendectomy.",
    });

    it("should generate a 32-byte secure random AES key", function () {
      const key = generateRecordKey();
      expect(key).to.be.instanceOf(Uint8Array);
      expect(key.length).to.equal(32);
    });

    it("should encrypt plaintext and decrypt back to exact original content", async function () {
      const { payload, key, keyHex } = await encryptRecord(medicalReport);
      expect(payload.ciphertext).to.be.a("string");
      expect(payload.iv).to.be.a("string");
      expect(keyHex).to.be.a("string");

      const decryptedBytes = await decryptRecord(payload, key);
      const decryptedText = new TextDecoder().decode(decryptedBytes);
      expect(decryptedText).to.equal(medicalReport);

      const directText = await decryptRecordToText(payload, keyHex);
      expect(directText).to.equal(medicalReport);
    });

    it("should fail decryption when ciphertext is tampered (integrity violation)", async function () {
      const { payload, key } = await encryptRecord(medicalReport);

      // Tamper ciphertext by modifying last characters
      const tamperedCiphertext =
        payload.ciphertext.slice(0, -4) + (payload.ciphertext.endsWith("A==") ? "B==" : "A==");

      const tamperedPayload = {
        ...payload,
        ciphertext: tamperedCiphertext,
      };

      try {
        await decryptRecord(tamperedPayload, key);
        expect.fail("Expected decryption to fail on tampered ciphertext");
      } catch (err: any) {
        expect(err.message).to.include("Decryption failed: integrity verification check failed");
      }
    });

    it("should fail decryption with wrong key", async function () {
      const { payload } = await encryptRecord(medicalReport);
      const wrongKey = generateRecordKey();

      try {
        await decryptRecord(payload, wrongKey);
        expect.fail("Expected decryption to fail with wrong key");
      } catch (err: any) {
        expect(err.message).to.include("Decryption failed: integrity verification check failed");
      }
    });
  });

  describe("2. Cryptographic Hashing & Pseudonymous Identity", function () {
    const sampleRecord = "Patient medical history, vitals, and surgical consent.";

    it("should produce deterministic 0x-prefixed 32-byte SHA-256 hashes", function () {
      const hash1 = computeSha256(sampleRecord);
      const hash2 = computeSha256(sampleRecord);

      expect(hash1).to.equal(hash2);
      expect(hash1.startsWith("0x")).to.be.true;
      expect(hash1.length).to.equal(66); // 0x + 64 hex characters
    });

    it("should detect changes in plaintext through hash mismatch", function () {
      const hashOriginal = computeSha256(sampleRecord);
      const hashModified = computeSha256(sampleRecord + " ");

      expect(hashOriginal).to.not.equal(hashModified);
      expect(secureHashCompare(hashOriginal, hashModified)).to.be.false;
      expect(secureHashCompare(hashOriginal, hashOriginal)).to.be.true;
    });

    it("should derive pseudonymous patient ID hash with zero on-chain PII", function () {
      const realSSN = "987-65-4321";
      const salt = "SECURE_HOSPITAL_SALT_KEY_9988";

      const pseudonym1 = hashPatientId(realSSN, salt);
      const pseudonym2 = hashPatientId(realSSN, salt);

      expect(pseudonym1).to.equal(pseudonym2);
      expect(pseudonym1.startsWith("0x")).to.be.true;
      expect(pseudonym1.length).to.equal(66);

      // Changing salt produces entirely different pseudonym
      const pseudonymOtherSalt = hashPatientId(realSSN, "DIFFERENT_SALT");
      expect(pseudonym1).to.not.equal(pseudonymOtherSalt);
    });
  });

  describe("3. ECIES Key Wrapping (secp256k1)", function () {
    let hospitalA: ReturnType<typeof generateHospitalEncryptionKeyPair>;
    let hospitalB: ReturnType<typeof generateHospitalEncryptionKeyPair>;

    beforeEach(function () {
      hospitalA = generateHospitalEncryptionKeyPair();
      hospitalB = generateHospitalEncryptionKeyPair();
    });

    it("should generate valid secp256k1 key pairs and derive public key", function () {
      expect(hospitalA.privateKeyHex).to.be.a("string");
      expect(hospitalA.publicKeyHex).to.be.a("string");

      const derivedPub = derivePublicKeyFromPrivate(hospitalA.privateKeyHex);
      expect(derivedPub).to.equal(hospitalA.publicKeyHex);
    });

    it("should wrap an AES-256 record key for Hospital B and allow only Hospital B to unwrap", function () {
      const recordKey = generateRecordKey();

      // Hospital A wraps key for Hospital B
      const wrappedKey = wrapRecordKey(recordKey, hospitalB.publicKeyHex);
      expect(wrappedKey.startsWith("0x")).to.be.true;

      // Hospital B unwraps with private key
      const recoveredKey = unwrapRecordKey(wrappedKey, hospitalB.privateKeyHex);
      expect(Buffer.from(recoveredKey).toString("hex")).to.equal(Buffer.from(recordKey).toString("hex"));

      // Hospital A tries to unwrap Hospital B's key -> should fail
      expect(() => unwrapRecordKey(wrappedKey, hospitalA.privateKeyHex)).to.throw();
    });

    it("should wrap keys for multiple recipient hospitals", function () {
      const recordKey = generateRecordKey();
      const hospital1Wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const hospital2Wallet = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

      const recipientMap = {
        [hospital1Wallet]: hospitalA.publicKeyHex,
        [hospital2Wallet]: hospitalB.publicKeyHex,
      };

      const wrappedMap = wrapRecordKeyForRecipients(recordKey, recipientMap);

      expect(wrappedMap[hospital1Wallet.toLowerCase()]).to.be.a("string");
      expect(wrappedMap[hospital2Wallet.toLowerCase()]).to.be.a("string");

      // Verify Hospital 1 unwraps their copy
      const recovered1 = unwrapRecordKey(
        wrappedMap[hospital1Wallet.toLowerCase()],
        hospitalA.privateKeyHex
      );
      expect(Buffer.from(recovered1).toString("hex")).to.equal(Buffer.from(recordKey).toString("hex"));

      // Verify Hospital 2 unwraps their copy
      const recovered2 = unwrapRecordKey(
        wrappedMap[hospital2Wallet.toLowerCase()],
        hospitalB.privateKeyHex
      );
      expect(Buffer.from(recovered2).toString("hex")).to.equal(Buffer.from(recordKey).toString("hex"));
    });
  });

  describe("4. ECDSA Issuer Signing & Signature Verification", function () {
    const doctorWallet = ethers.Wallet.createRandom();
    const attackerWallet = ethers.Wallet.createRandom();
    const recordHash = computeSha256("Clinical Record Integrity Payload");

    it("should sign recordHash and verify issuer wallet address", async function () {
      const signature = await signRecordHash(recordHash, doctorWallet);
      expect(signature.startsWith("0x")).to.be.true;

      const recovered = recoverSignerAddress(recordHash, signature);
      expect(recovered.toLowerCase()).to.equal(doctorWallet.address.toLowerCase());

      const isValid = verifyRecordSignature(recordHash, signature, doctorWallet.address);
      expect(isValid).to.be.true;
    });

    it("should reject forged or mismatched issuer signatures", async function () {
      const signature = await signRecordHash(recordHash, attackerWallet);

      // Verifying against doctorWallet fails
      const isValid = verifyRecordSignature(recordHash, signature, doctorWallet.address);
      expect(isValid).to.be.false;

      // Verifying against altered recordHash fails
      const alteredHash = computeSha256("Altered Payload");
      const isAlteredValid = verifyRecordSignature(alteredHash, signature, attackerWallet.address);
      expect(isAlteredValid).to.be.false;
    });
  });
});
