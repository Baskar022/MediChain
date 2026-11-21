import { expect } from "chai";
import { ethers } from "ethers";
import crypto from "crypto";
import { generateRecordKey, encryptRecord, decryptRecordToText } from "../aes";
import { computeSha256 } from "../hash";
import { generateHospitalEncryptionKeyPair, wrapRecordKey, unwrapRecordKey } from "../ecies";
import { IpfsService } from "../../ipfs/service";
import { validateFhirClinicalDocument } from "../../../../../interop/types/fhir";
import { createSyntheticFhirDocument, SYNTHETIC_PATIENTS } from "../../../../../scripts/generate-synthetic-data";
import { dbManager } from "../../db";

describe("Phase F-4: Real File Pipeline, Client Encryption, IPFS & Tamper Detection", function () {
  this.timeout(10000);

  const doctorWallet = ethers.Wallet.createRandom();
  const patientWallet = ethers.Wallet.createRandom();
  const hospitalBWallet = ethers.Wallet.createRandom();

  const doctorEcies = generateHospitalEncryptionKeyPair();
  const patientEcies = generateHospitalEncryptionKeyPair();
  const hospitalBEcies = generateHospitalEncryptionKeyPair();

  const samplePlaintext = JSON.stringify({
    diagnosis: "Acute Coronary Syndrome - Synthetic Clinical Record",
    vitals: { hr: 88, bp: "135/85", o2: 97 },
    notes: "Patient administered aspirin and scheduled for coronary angiography.",
    timestamp: Date.now(),
  });

  describe("1. Client-Side AES-256-GCM Encryption & Multi-Recipient ECIES Wrapping", () => {
    let aesKey: Uint8Array;
    let encryptedPayload: any;
    let recordHash: string;
    let cipherHash: string;
    let issuerSignature: string;

    it("should encrypt clinical payload client-side with AES-256-GCM", async () => {
      aesKey = generateRecordKey();
      recordHash = computeSha256(samplePlaintext);
      expect(recordHash).to.match(/^0x[a-fA-F0-9]{64}$/);

      const res = await encryptRecord(samplePlaintext, aesKey);
      encryptedPayload = res.payload;
      expect(encryptedPayload.ciphertext).to.be.a("string").that.is.not.empty;
      expect(encryptedPayload.iv).to.be.a("string").that.is.not.empty;

      cipherHash = computeSha256(encryptedPayload.ciphertext);
      expect(cipherHash).to.not.equal(recordHash);

      // Doctor signs plaintext recordHash
      issuerSignature = await doctorWallet.signMessage(recordHash);
      const recoveredSigner = ethers.verifyMessage(recordHash, issuerSignature);
      expect(recoveredSigner.toLowerCase()).to.equal(doctorWallet.address.toLowerCase());
    });

    it("should wrap the AES record key separately for doctor, patient, and recipient hospital", async () => {
      const wrappedForDoctor = wrapRecordKey(aesKey, doctorEcies.publicKeyHex);
      const wrappedForPatient = wrapRecordKey(aesKey, patientEcies.publicKeyHex);
      const wrappedForHospitalB = wrapRecordKey(aesKey, hospitalBEcies.publicKeyHex);

      // Doctor unwraps
      const unwrappedByDoc = unwrapRecordKey(wrappedForDoctor, doctorEcies.privateKeyHex);
      expect(Buffer.from(unwrappedByDoc).toString("hex")).to.equal(Buffer.from(aesKey).toString("hex"));

      // Patient unwraps
      const unwrappedByPatient = unwrapRecordKey(wrappedForPatient, patientEcies.privateKeyHex);
      expect(Buffer.from(unwrappedByPatient).toString("hex")).to.equal(Buffer.from(aesKey).toString("hex"));

      // Hospital B unwraps
      const unwrappedByHospitalB = unwrapRecordKey(wrappedForHospitalB, hospitalBEcies.privateKeyHex);
      expect(Buffer.from(unwrappedByHospitalB).toString("hex")).to.equal(Buffer.from(aesKey).toString("hex"));

      // Decrypt using unwrapped key
      const decrypted = await decryptRecordToText(encryptedPayload, unwrappedByHospitalB);
      expect(decrypted).to.equal(samplePlaintext);
    });

    it("should reject decryption when ciphertext has been tampered", async () => {
      // Corrupt one base64 character in ciphertext
      const originalCipher = encryptedPayload.ciphertext;
      const tamperedCipher =
        originalCipher.slice(0, -4) + (originalCipher.endsWith("AA==") ? "BB==" : "AA==");
      const tamperedPayload = { ...encryptedPayload, ciphertext: tamperedCipher };

      try {
        await decryptRecordToText(tamperedPayload, aesKey);
        expect.fail("Should have thrown error on tampered ciphertext");
      } catch (err: any) {
        expect(err.message).to.include("Decryption failed");
      }
    });
  });

  describe("2. IPFS Storage Service (Pinata & Resilient Fallback)", () => {
    it("should pin encrypted payload buffer and return standard CID and IPFS URI", async () => {
      const sampleBlob = Buffer.from("ENCRYPTED_SYNTHETIC_CIPHERTEXT_BLOB_FOR_TESTING");
      const pinResult = await IpfsService.pinFile(sampleBlob, "test_record_001.enc", {
        recordType: "CARDIOLOGY",
      });

      expect(pinResult.cid).to.be.a("string").that.is.not.empty;
      expect(pinResult.ipfsUri).to.match(/^ipfs:\/\/bafk/);
      expect(pinResult.sizeBytes).to.equal(sampleBlob.length);
      expect(["PINATA", "KUBO_LOCAL", "LOCAL_STORE_FALLBACK"]).to.include(pinResult.provider);

      // Resolving content should return original bytes
      const resolved = await IpfsService.fetchContent(pinResult.ipfsUri);
      expect(resolved.data.toString("utf-8")).to.equal("ENCRYPTED_SYNTHETIC_CIPHERTEXT_BLOB_FOR_TESTING");
    });
  });

  describe("3. Record Versioning Lineage & Revocation", () => {
    const parentId = `rec_v1_${Date.now()}`;
    const childId = `rec_v2_${Date.now()}`;
    const pseudonym = "0x" + crypto.randomBytes(32).toString("hex");

    it("should anchor initial version v1 and update to version v2 with lineage link", () => {
      dbManager.insertRecord({
        record_id: parentId,
        patient_pseudonym: pseudonym,
        record_type: "CARDIOLOGY",
        record_hash: "0x" + crypto.randomBytes(32).toString("hex"),
        cipher_hash: "0x" + crypto.randomBytes(32).toString("hex"),
        issuer_hospital: doctorWallet.address,
        issuer_doctor: doctorWallet.address,
        issuer_signature: "0x" + crypto.randomBytes(65).toString("hex"),
        storage_path: `storage/${parentId}.enc`,
        storage_ref: `ipfs://bafkrei_parent`,
        file_name: "ecg_initial.json",
        mime_type: "application/json",
        file_size: 1024,
        version: 1,
        previous_record_id: null,
        created_at: Date.now(),
        is_revoked: 0,
      });

      const parentRecord = dbManager.getRecord(parentId);
      expect(parentRecord).to.exist;
      expect(parentRecord?.version).to.equal(1);

      // Anchor Version 2 linked to parent
      dbManager.insertRecord({
        record_id: childId,
        patient_pseudonym: pseudonym,
        record_type: "CARDIOLOGY",
        record_hash: "0x" + crypto.randomBytes(32).toString("hex"),
        cipher_hash: "0x" + crypto.randomBytes(32).toString("hex"),
        issuer_hospital: doctorWallet.address,
        issuer_doctor: doctorWallet.address,
        issuer_signature: "0x" + crypto.randomBytes(65).toString("hex"),
        storage_path: `storage/${childId}.enc`,
        storage_ref: `ipfs://bafkrei_child`,
        file_name: "ecg_followup.json",
        mime_type: "application/json",
        file_size: 1200,
        version: 2,
        previous_record_id: parentId,
        created_at: Date.now() + 1000,
        is_revoked: 0,
      });

      const childRecord = dbManager.getRecord(childId);
      expect(childRecord).to.exist;
      expect(childRecord?.version).to.equal(2);
      expect(childRecord?.previous_record_id).to.equal(parentId);
    });

    it("should mark revoked records without deleting physical history", () => {
      dbManager.revokeRecord(childId);
      const revokedRecord = dbManager.getRecord(childId);
      expect(revokedRecord).to.exist;
      expect(revokedRecord?.is_revoked).to.equal(1);
    });
  });

  describe("4. FHIR-Inspired Canonical Schema & Synthetic Data Generation", () => {
    it("should generate valid synthetic FHIR documents compliant with schema", () => {
      const patient = SYNTHETIC_PATIENTS[0];
      const inst = {
        id: "hospital-sepolia-01",
        name: "City General Hospital",
        chainId: "11155111",
        doctorName: "Dr. Evelyn Reed, MD",
        doctorWallet: doctorWallet.address,
      };

      const fhirDoc = createSyntheticFhirDocument("CARDIOLOGY", patient, inst);
      const validation = validateFhirClinicalDocument(fhirDoc);

      expect(validation.valid).to.be.true;
      expect(validation.errors).to.have.lengthOf(0);
      expect(fhirDoc.resourceType).to.equal("DiagnosticReport");
      expect(fhirDoc.category).to.equal("CARDIOLOGY");
      expect(fhirDoc.subject.globalPatientId).to.equal(patient.globalPatientId);
    });
  });
});
