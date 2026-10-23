import { expect } from "chai";
import fs from "fs";
import path from "path";
import { dbManager, RecordEntity } from "../index";
import { computeSha256 } from "../../crypto/hash";
import { encryptRecord, decryptRecordToText } from "../../crypto/aes";
import {
  generateHospitalEncryptionKeyPair,
  wrapRecordKey,
  unwrapRecordKey,
} from "../../crypto/ecies";

describe("Phase 3: Database & Encrypted Off-Chain Storage Layer", function () {
  const testRecordId = "rec_test_" + Date.now();
  const patientPseudonym = "0x" + "11".repeat(32);
  const hospitalA = generateHospitalEncryptionKeyPair();
  const hospitalB = generateHospitalEncryptionKeyPair();

  let plaintextDiagnostic: string;
  let recordHash: string;
  let cipherHash: string;
  let ciphertextBase64: string;
  let ivBase64: string;
  let recordKey: Uint8Array;
  let wrappedKeyHospitalB: string;

  before(async function () {
    plaintextDiagnostic = JSON.stringify({
      testType: "MRI Lumbar Spine",
      findings: "L4-L5 disc herniation with mild radiculopathy",
      doctorNotes: "Refer for physical therapy and conservative management.",
    });

    // 1. Client-side encryption with AES-256-GCM
    const encResult = await encryptRecord(plaintextDiagnostic);
    ciphertextBase64 = encResult.payload.ciphertext;
    ivBase64 = encResult.payload.iv;
    recordKey = encResult.key;

    // 2. Compute dual hashes
    recordHash = computeSha256(plaintextDiagnostic);
    cipherHash = computeSha256(ciphertextBase64);

    // 3. ECIES key wrap for Hospital B
    wrappedKeyHospitalB = wrapRecordKey(recordKey, hospitalB.publicKeyHex);
  });

  describe("1. SQLite Database Schema & Queries", function () {
    it("should insert record metadata and retrieve it by recordId", function () {
      const entity: RecordEntity = {
        record_id: testRecordId,
        patient_pseudonym: patientPseudonym,
        record_type: "Imaging",
        record_hash: recordHash,
        cipher_hash: cipherHash,
        issuer_hospital: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        issuer_doctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        issuer_signature: "0x" + "aa".repeat(65),
        storage_path: `storage/${testRecordId}.enc`,
        file_name: "mri_lumbar.json",
        mime_type: "application/json",
        file_size: 1024,
        version: 1,
        previous_record_id: null,
        created_at: Date.now(),
        is_revoked: 0,
      };

      dbManager.insertRecord(entity);

      const retrieved = dbManager.getRecord(testRecordId);
      expect(retrieved).to.not.be.undefined;
      expect(retrieved?.record_id).to.equal(testRecordId);
      expect(retrieved?.record_type).to.equal("Imaging");
      expect(retrieved?.record_hash).to.equal(recordHash);
      expect(retrieved?.cipher_hash).to.equal(cipherHash);
    });

    it("should query records by patient pseudonym and hospital wallet", function () {
      const patientRecords = dbManager.getRecordsByPatient(patientPseudonym);
      expect(patientRecords.length).to.be.greaterThan(0);
      expect(patientRecords[0].patient_pseudonym).to.equal(patientPseudonym.toLowerCase());

      const hospitalRecords = dbManager.getRecordsByHospital(
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
      );
      expect(hospitalRecords.length).to.be.greaterThan(0);
    });

    it("should store and retrieve wrapped keys per recipient hospital", function () {
      const hospitalBWallet = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
      dbManager.insertWrappedKey(testRecordId, hospitalBWallet, wrappedKeyHospitalB);

      const retrievedKey = dbManager.getWrappedKey(testRecordId, hospitalBWallet);
      expect(retrievedKey).to.equal(wrappedKeyHospitalB);

      const allKeys = dbManager.getWrappedKeysByRecord(testRecordId);
      expect(allKeys.length).to.be.greaterThan(0);
    });

    it("should manage access requests lifecycle (PENDING -> APPROVED)", function () {
      const reqId = "req_" + Date.now();
      const newReq = dbManager.createAccessRequest({
        id: reqId,
        patient_pseudonym: patientPseudonym,
        record_id: testRecordId,
        requesting_hospital: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        requesting_doctor: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        reason: "Follow-up consultation for spinal pain.",
        scope: "SpecificRecord",
      });

      expect(newReq.status).to.equal("PENDING");

      const patientReqs = dbManager.getAccessRequestsForPatient(patientPseudonym);
      expect(patientReqs.some((r) => r.id === reqId)).to.be.true;

      dbManager.updateAccessRequestStatus(reqId, "APPROVED");
      const updatedReqs = dbManager.getAccessRequestsForPatient(patientPseudonym);
      const approved = updatedReqs.find((r) => r.id === reqId);
      expect(approved?.status).to.equal("APPROVED");
    });
  });

  describe("2. Encrypted Off-Chain File Storage & Live Tamper Demo", function () {
    const storageFilePath = path.join(dbManager.storageDir, `${testRecordId}.enc`);

    before(function () {
      // Write encrypted payload to local /storage directory
      const fileData = JSON.stringify({
        ciphertext: ciphertextBase64,
        iv: ivBase64,
      });
      fs.writeFileSync(storageFilePath, fileData, "utf-8");
    });

    it("should verify stored encrypted payload matches on-chain cipherHash", function () {
      const rawContent = fs.readFileSync(storageFilePath, "utf-8");
      const parsed = JSON.parse(rawContent);

      const liveCipherHash = computeSha256(parsed.ciphertext);
      expect(liveCipherHash.toLowerCase()).to.equal(cipherHash.toLowerCase());
    });

    it("should allow Hospital B to unwrap key and decrypt record cleanly", async function () {
      const rawContent = fs.readFileSync(storageFilePath, "utf-8");
      const parsed = JSON.parse(rawContent);

      const unwrappedKey = unwrapRecordKey(wrappedKeyHospitalB, hospitalB.privateKeyHex);
      const decryptedText = await decryptRecordToText(parsed, unwrappedKey);

      expect(decryptedText).to.equal(plaintextDiagnostic);
    });

    it("should perform live Tamper Demo: alter stored file and detect hash violation immediately", function () {
      // 1. Initially untampered
      expect(dbManager.isRecordTampered(testRecordId)).to.be.false;

      // 2. Trigger tamper
      const tamperResult = dbManager.tamperRecordFile(testRecordId);
      expect(tamperResult.tampered).to.be.true;
      expect(tamperResult.newHash).to.not.equal(tamperResult.originalHash);
      expect(dbManager.isRecordTampered(testRecordId)).to.be.true;

      // 3. Read file again - live hash MUST fail verification
      const tamperedFileContent = fs.readFileSync(storageFilePath, "utf-8");
      const liveTamperedHash = computeSha256(tamperedFileContent);
      expect(liveTamperedHash.toLowerCase()).to.not.equal(cipherHash.toLowerCase());

      // 4. Restore original file
      const restoreResult = dbManager.restoreRecordFile(testRecordId);
      expect(restoreResult.restored).to.be.true;
      expect(dbManager.isRecordTampered(testRecordId)).to.be.false;

      // 5. Read restored file - live hash MUST match again
      const restoredRaw = fs.readFileSync(storageFilePath, "utf-8");
      const parsedRestored = JSON.parse(restoredRaw);
      const liveRestoredHash = computeSha256(parsedRestored.ciphertext);
      expect(liveRestoredHash.toLowerCase()).to.equal(cipherHash.toLowerCase());
    });
  });
});
