import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  HospitalRegistry,
  AuditLog,
  RecordRegistry,
  ConsentManager,
} from "../typechain-types";

describe("MediChain Core System", function () {
  let admin: SignerWithAddress;
  let hospital1: SignerWithAddress;
  let hospital2: SignerWithAddress;
  let doctor1: SignerWithAddress;
  let doctor2: SignerWithAddress;
  let patient1: SignerWithAddress;
  let patient2: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;

  let hospitalRegistry: HospitalRegistry;
  let auditLog: AuditLog;
  let recordRegistry: RecordRegistry;
  let consentManager: ConsentManager;

  const dummyPublicKey1 = ethers.hexlify(ethers.randomBytes(65));
  const dummyPublicKey2 = ethers.hexlify(ethers.randomBytes(65));

  const patient1Pseudonym = ethers.keccak256(ethers.toUtf8Bytes("PATIENT_ALICE_SALT_12345"));
  const patient2Pseudonym = ethers.keccak256(ethers.toUtf8Bytes("PATIENT_BOB_SALT_67890"));

  beforeEach(async function () {
    [admin, hospital1, hospital2, doctor1, doctor2, patient1, patient2, unauthorizedUser] =
      await ethers.getSigners();

    // 1. Deploy HospitalRegistry
    const HospitalRegistryFactory = await ethers.getContractFactory("HospitalRegistry");
    hospitalRegistry = await HospitalRegistryFactory.deploy(admin.address);
    await hospitalRegistry.waitForDeployment();

    // 2. Deploy AuditLog
    const AuditLogFactory = await ethers.getContractFactory("AuditLog");
    auditLog = await AuditLogFactory.deploy(admin.address);
    await auditLog.waitForDeployment();

    // 3. Deploy RecordRegistry
    const RecordRegistryFactory = await ethers.getContractFactory("RecordRegistry");
    recordRegistry = await RecordRegistryFactory.deploy(
      admin.address,
      await hospitalRegistry.getAddress(),
      await auditLog.getAddress()
    );
    await recordRegistry.waitForDeployment();

    // 4. Deploy ConsentManager
    const ConsentManagerFactory = await ethers.getContractFactory("ConsentManager");
    consentManager = await ConsentManagerFactory.deploy(
      admin.address,
      await hospitalRegistry.getAddress(),
      await recordRegistry.getAddress(),
      await auditLog.getAddress()
    );
    await consentManager.waitForDeployment();

    // 5. Grant RECORDER_ROLE on AuditLog to RecordRegistry and ConsentManager
    const RECORDER_ROLE = await auditLog.RECORDER_ROLE();
    await auditLog.connect(admin).grantRole(RECORDER_ROLE, await recordRegistry.getAddress());
    await auditLog.connect(admin).grantRole(RECORDER_ROLE, await consentManager.getAddress());
  });

  describe("1. HospitalRegistry", function () {
    it("should allow admin to register a hospital", async function () {
      const tx = await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital1.address, "Metro Health Medical Center", dummyPublicKey1);

      await expect(tx)
        .to.emit(hospitalRegistry, "HospitalRegistered")
        .withArgs(
          hospital1.address,
          ethers.keccak256(ethers.toUtf8Bytes("Metro Health Medical Center")),
          "Metro Health Medical Center",
          dummyPublicKey1,
          (ts: any) => typeof ts === "bigint"
        );

      expect(await hospitalRegistry.isHospitalActive(hospital1.address)).to.be.true;
      const h = await hospitalRegistry.getHospital(hospital1.address);
      expect(h.name).to.equal("Metro Health Medical Center");
      expect(h.publicKey).to.equal(dummyPublicKey1);

      const allHospitals = await hospitalRegistry.getAllHospitals();
      expect(allHospitals.length).to.equal(1);
      expect(allHospitals[0]).to.equal(hospital1.address);
    });

    it("should reject non-admin registering a hospital", async function () {
      await expect(
        hospitalRegistry
          .connect(unauthorizedUser)
          .registerHospital(hospital1.address, "Illegal Hospital", dummyPublicKey1)
      ).to.be.revertedWithCustomError(hospitalRegistry, "UnauthorizedCaller");
    });

    it("should reject duplicate hospital registration or zero address", async function () {
      await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital1.address, "Metro Health", dummyPublicKey1);

      await expect(
        hospitalRegistry.connect(admin).registerHospital(hospital1.address, "Metro Health Duplicate", dummyPublicKey1)
      ).to.be.revertedWithCustomError(hospitalRegistry, "HospitalAlreadyRegistered");

      await expect(
        hospitalRegistry.connect(admin).registerHospital(ethers.ZeroAddress, "Zero", dummyPublicKey1)
      ).to.be.revertedWithCustomError(hospitalRegistry, "ZeroAddressNotAllowed");

      await expect(
        hospitalRegistry.connect(admin).registerHospital(hospital2.address, "", dummyPublicKey1)
      ).to.be.revertedWithCustomError(hospitalRegistry, "EmptyStringNotAllowed");

      await expect(
        hospitalRegistry.connect(admin).registerHospital(hospital2.address, "H2", "0x")
      ).to.be.revertedWithCustomError(hospitalRegistry, "EmptyPublicKeyNotAllowed");
    });

    it("should allow suspension, reactivation, and permanent revocation of a hospital", async function () {
      await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital1.address, "Metro Health", dummyPublicKey1);

      await expect(hospitalRegistry.connect(admin).suspendHospital(hospital1.address, "Annual Compliance Audit"))
        .to.emit(hospitalRegistry, "HospitalSuspended");

      expect(await hospitalRegistry.isHospitalActive(hospital1.address)).to.be.false;

      await expect(hospitalRegistry.connect(admin).reactivateHospital(hospital1.address))
        .to.emit(hospitalRegistry, "HospitalReactivated");

      expect(await hospitalRegistry.isHospitalActive(hospital1.address)).to.be.true;

      await expect(hospitalRegistry.connect(admin).revokeHospital(hospital1.address, "Malpractice Infraction"))
        .to.emit(hospitalRegistry, "HospitalRevoked");

      expect(await hospitalRegistry.isHospitalActive(hospital1.address)).to.be.false;
    });

    it("should allow hospital to update its public key", async function () {
      await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital1.address, "Metro Health", dummyPublicKey1);

      const newKey = ethers.hexlify(ethers.randomBytes(65));
      await expect(hospitalRegistry.connect(hospital1).updateHospitalPublicKey(newKey))
        .to.emit(hospitalRegistry, "HospitalPublicKeyUpdated")
        .withArgs(hospital1.address, newKey, (ts: any) => typeof ts === "bigint");

      const h = await hospitalRegistry.getHospital(hospital1.address);
      expect(h.publicKey).to.equal(newKey);
    });

    it("should allow hospital to register a doctor, revoke doctor, and query lists", async function () {
      await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital1.address, "Metro Health", dummyPublicKey1);

      await expect(
        hospitalRegistry
          .connect(hospital1)
          .registerDoctor(doctor1.address, "Dr. Sarah Chen", "MD-LIC-88391")
      )
        .to.emit(hospitalRegistry, "DoctorRegistered")
        .withArgs(doctor1.address, hospital1.address, "Dr. Sarah Chen", "MD-LIC-88391", (ts: any) => typeof ts === "bigint");

      let [isActive, affiliatedHospital] = await hospitalRegistry.isDoctorActive(doctor1.address);
      expect(isActive).to.be.true;
      expect(affiliatedHospital).to.equal(hospital1.address);

      const doc = await hospitalRegistry.getDoctor(doctor1.address);
      expect(doc.name).to.equal("Dr. Sarah Chen");
      expect(doc.licenseNumber).to.equal("MD-LIC-88391");

      const docAddresses = await hospitalRegistry.getDoctorsByHospital(hospital1.address);
      expect(docAddresses.length).to.equal(1);
      expect(docAddresses[0]).to.equal(doctor1.address);

      // Revoke doctor
      await expect(hospitalRegistry.connect(hospital1).revokeDoctor(doctor1.address))
        .to.emit(hospitalRegistry, "DoctorRevoked");

      [isActive] = await hospitalRegistry.isDoctorActive(doctor1.address);
      expect(isActive).to.be.false;
    });

    it("should support pausing and unpausing by admin", async function () {
      await hospitalRegistry.connect(admin).pause();
      await expect(
        hospitalRegistry.connect(admin).registerHospital(hospital1.address, "Metro", dummyPublicKey1)
      ).to.be.revertedWithCustomError(hospitalRegistry, "EnforcedPause");

      await hospitalRegistry.connect(admin).unpause();
      await expect(
        hospitalRegistry.connect(admin).registerHospital(hospital1.address, "Metro", dummyPublicKey1)
      ).to.emit(hospitalRegistry, "HospitalRegistered");
    });
  });

  describe("2. RecordRegistry & Integrity Verification", function () {
    const plainText = "Patient Diagnosis: Type 2 Diabetes, HbA1c 7.4%. Prescribed Metformin 500mg BID.";
    const plainHash = ethers.sha256(ethers.toUtf8Bytes(plainText));
    const cipherText = "ENCRYPTED_AES_256_GCM_CIPHERTEXT_BASE64_PAYLOAD_HERE";
    const cipherHash = ethers.sha256(ethers.toUtf8Bytes(cipherText));
    const storageRef = "/storage/record_abc123.enc";

    beforeEach(async function () {
      await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital1.address, "Metro Health", dummyPublicKey1);

      await hospitalRegistry
        .connect(hospital1)
        .registerDoctor(doctor1.address, "Dr. Sarah Chen", "MD-LIC-88391");
    });

    it("should allow an authorized doctor to add a record with ECDSA signature", async function () {
      const signature = await doctor1.signMessage(ethers.getBytes(plainHash));

      const tx = await recordRegistry
        .connect(doctor1)
        .addRecord(patient1Pseudonym, plainHash, cipherHash, 1, signature, storageRef);

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      const recordCount = await recordRegistry.getPatientRecordCount(patient1Pseudonym);
      expect(recordCount).to.equal(1n);

      const recordId = await recordRegistry.getPatientRecordByIndex(patient1Pseudonym, 0);
      const meta = await recordRegistry.getRecordMeta(recordId);

      expect(meta.patientIdHash).to.equal(patient1Pseudonym);
      expect(meta.recordHash).to.equal(plainHash);
      expect(meta.cipherHash).to.equal(cipherHash);
      expect(meta.issuerHospital).to.equal(hospital1.address);
      expect(meta.issuerDoctor).to.equal(doctor1.address);
      expect(meta.version).to.equal(1n);
      expect(meta.isValid).to.equal(true);

      expect(await recordRegistry.getAllRecordCount()).to.equal(1n);
      const allIds = await recordRegistry.getAllRecordIds();
      expect(allIds.length).to.equal(1);
    });

    it("should reject adding record by unauthorized user", async function () {
      const sig = await unauthorizedUser.signMessage(ethers.getBytes(plainHash));
      await expect(
        recordRegistry
          .connect(unauthorizedUser)
          .addRecord(patient1Pseudonym, plainHash, cipherHash, 1, sig, storageRef)
      ).to.be.revertedWithCustomError(recordRegistry, "UnauthorizedIssuer");
    });

    it("should reject adding record if signer signature does not match issuer", async function () {
      const invalidSig = await patient1.signMessage(ethers.getBytes(plainHash));
      await expect(
        recordRegistry
          .connect(doctor1)
          .addRecord(patient1Pseudonym, plainHash, cipherHash, 1, invalidSig, storageRef)
      ).to.be.revertedWithCustomError(recordRegistry, "InvalidIssuerSignature");
    });

    it("should verify record integrity mathematically and detect tampering", async function () {
      const signature = await doctor1.signMessage(ethers.getBytes(plainHash));
      await recordRegistry
        .connect(doctor1)
        .addRecord(patient1Pseudonym, plainHash, cipherHash, 1, signature, storageRef);

      const recordId = (await recordRegistry.getPatientRecordIds(patient1Pseudonym))[0];

      // Exact match check
      const [isValid, isSigValid, recoveredSigner] = await recordRegistry.verifyRecordIntegrity(
        recordId,
        plainHash,
        cipherHash
      );
      expect(isValid).to.be.true;
      expect(isSigValid).to.be.true;
      expect(recoveredSigner).to.equal(doctor1.address);

      // Tampered plaintext check
      const tamperedPlainHash = ethers.sha256(ethers.toUtf8Bytes("TAMPERED DIAGNOSIS CONTENT"));
      const [tamperedValid] = await recordRegistry.verifyRecordIntegrity(
        recordId,
        tamperedPlainHash,
        cipherHash
      );
      expect(tamperedValid).to.be.false;

      // Tampered ciphertext check
      const tamperedCipherHash = ethers.sha256(ethers.toUtf8Bytes("TAMPERED_CIPHERTEXT"));
      const [cipherTamperedValid] = await recordRegistry.verifyRecordIntegrity(
        recordId,
        plainHash,
        tamperedCipherHash
      );
      expect(cipherTamperedValid).to.be.false;
    });

    it("should support record versioning linking to previous version", async function () {
      const sig1 = await doctor1.signMessage(ethers.getBytes(plainHash));
      await recordRegistry
        .connect(doctor1)
        .addRecord(patient1Pseudonym, plainHash, cipherHash, 1, sig1, storageRef);

      const recordIdV1 = (await recordRegistry.getPatientRecordIds(patient1Pseudonym))[0];

      // Update to Version 2
      const updatedPlain = "Follow-up: HbA1c reduced to 6.8%. Continued on current therapy.";
      const updatedPlainHash = ethers.sha256(ethers.toUtf8Bytes(updatedPlain));
      const updatedCipherHash = ethers.sha256(ethers.toUtf8Bytes("UPDATED_CIPHERTEXT"));
      const sig2 = await doctor1.signMessage(ethers.getBytes(updatedPlainHash));

      const updateTx = await recordRegistry
        .connect(doctor1)
        .updateRecordVersion(
          recordIdV1,
          updatedPlainHash,
          updatedCipherHash,
          sig2,
          "/storage/version_2.enc"
        );
      await updateTx.wait();

      const recordIds = await recordRegistry.getPatientRecordIds(patient1Pseudonym);
      expect(recordIds.length).to.equal(2);

      const metaV2 = await recordRegistry.getRecordMeta(recordIds[1]);
      expect(metaV2.version).to.equal(2n);
      expect(metaV2.previousRecordId).to.equal(recordIdV1);
      expect(metaV2.recordHash).to.equal(updatedPlainHash);
    });

    it("should allow issuer to revoke a record and reject updates to revoked record", async function () {
      const sig = await doctor1.signMessage(ethers.getBytes(plainHash));
      await recordRegistry
        .connect(doctor1)
        .addRecord(patient1Pseudonym, plainHash, cipherHash, 1, sig, storageRef);

      const recordId = (await recordRegistry.getPatientRecordIds(patient1Pseudonym))[0];

      await expect(recordRegistry.connect(doctor1).revokeRecord(recordId, "Issued to incorrect patient file"))
        .to.emit(recordRegistry, "RecordRevoked")
        .withArgs(recordId, doctor1.address, "Issued to incorrect patient file", (ts: any) => typeof ts === "bigint");

      const meta = await recordRegistry.getRecordMeta(recordId);
      expect(meta.isValid).to.be.false;

      // Verification fails if revoked
      const [isValid] = await recordRegistry.verifyRecordIntegrity(recordId, plainHash, cipherHash);
      expect(isValid).to.be.false;

      // Re-updating revoked record fails
      await expect(
        recordRegistry.connect(doctor1).updateRecordVersion(recordId, plainHash, cipherHash, sig, storageRef)
      ).to.be.revertedWithCustomError(recordRegistry, "RecordIsRevoked");
    });

    it("should support pause and unpause by admin", async function () {
      await recordRegistry.connect(admin).pause();
      const sig = await doctor1.signMessage(ethers.getBytes(plainHash));
      await expect(
        recordRegistry.connect(doctor1).addRecord(patient1Pseudonym, plainHash, cipherHash, 1, sig, storageRef)
      ).to.be.revertedWithCustomError(recordRegistry, "EnforcedPause");

      await recordRegistry.connect(admin).unpause();
      await expect(
        recordRegistry.connect(doctor1).addRecord(patient1Pseudonym, plainHash, cipherHash, 1, sig, storageRef)
      ).to.emit(recordRegistry, "RecordAdded");
    });
  });

  describe("3. ConsentManager & Break-Glass Emergency Access", function () {
    let sampleRecordId: string;

    beforeEach(async function () {
      await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital1.address, "Hospital 1", dummyPublicKey1);
      await hospitalRegistry
        .connect(hospital1)
        .registerDoctor(doctor1.address, "Dr. Sarah Chen", "MD-LIC-88391");

      await hospitalRegistry
        .connect(admin)
        .registerHospital(hospital2.address, "Hospital 2", dummyPublicKey2);
      await hospitalRegistry
        .connect(hospital2)
        .registerDoctor(doctor2.address, "Dr. Marcus Brody", "MD-LIC-44912");

      await consentManager.connect(patient1).registerPatient(patient1Pseudonym);

      const plainHash = ethers.sha256(ethers.toUtf8Bytes("Diagnostic Panel"));
      const cipherHash = ethers.sha256(ethers.toUtf8Bytes("CIPHER_PAYLOAD"));
      const sig = await doctor1.signMessage(ethers.getBytes(plainHash));

      await recordRegistry
        .connect(doctor1)
        .addRecord(patient1Pseudonym, plainHash, cipherHash, 0, sig, "storage/panel1.enc");

      sampleRecordId = (await recordRegistry.getPatientRecordIds(patient1Pseudonym))[0];
    });

    it("should allow patient to grant and check access for another hospital", async function () {
      let [hasAccess] = await consentManager.checkAccess(patient1Pseudonym, sampleRecordId, hospital2.address);
      expect(hasAccess).to.be.false;

      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 7 * 86400;
      const grantTx = await consentManager
        .connect(patient1)
        .grantAccess(patient1Pseudonym, hospital2.address, sampleRecordId, 0, validUntil);

      await expect(grantTx).to.emit(consentManager, "ConsentGranted");

      [hasAccess] = await consentManager.checkAccess(patient1Pseudonym, sampleRecordId, hospital2.address);
      expect(hasAccess).to.be.true;

      [hasAccess] = await consentManager.checkAccess(patient1Pseudonym, sampleRecordId, doctor2.address);
      expect(hasAccess).to.be.true;

      const hospitalConsents = await consentManager.getHospitalConsents(hospital2.address);
      expect(hospitalConsents.length).to.equal(1);

      const consentDetails = await consentManager.getConsent(hospitalConsents[0]);
      expect(consentDetails.patientIdHash).to.equal(patient1Pseudonym);
      expect(consentDetails.hospital).to.equal(hospital2.address);
    });

    it("should allow patient self-access unconditionally", async function () {
      const [hasAccess, , reason] = await consentManager.checkAccess(
        patient1Pseudonym,
        sampleRecordId,
        patient1.address
      );
      expect(hasAccess).to.be.true;
      expect(reason).to.equal("Patient self-access");
    });

    it("should allow patient to grant full-history (AllRecords) consent", async function () {
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 30 * 86400;
      await consentManager
        .connect(patient1)
        .grantAccess(patient1Pseudonym, hospital2.address, ethers.ZeroHash, 1, validUntil);

      const [hasAccess] = await consentManager.checkAccess(patient1Pseudonym, sampleRecordId, hospital2.address);
      expect(hasAccess).to.be.true;
    });

    it("should immediately revoke access when requested by patient", async function () {
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 7 * 86400;
      await consentManager
        .connect(patient1)
        .grantAccess(patient1Pseudonym, hospital2.address, sampleRecordId, 0, validUntil);

      const consents = await consentManager.getPatientConsents(patient1Pseudonym);
      const consentId = consents[0];

      await expect(consentManager.connect(patient1).revokeAccess(consentId))
        .to.emit(consentManager, "ConsentRevoked");

      const [hasAccess] = await consentManager.checkAccess(patient1Pseudonym, sampleRecordId, hospital2.address);
      expect(hasAccess).to.be.false;

      // Second revocation fails
      await expect(consentManager.connect(patient1).revokeAccess(consentId))
        .to.be.revertedWithCustomError(consentManager, "ConsentAlreadyRevoked");
    });

    it("should handle emergency break-glass access with time-box and audit trail", async function () {
      const justification = "Patient unconscious in ER following acute trauma. Immediate surgical history needed.";

      const tx = await consentManager
        .connect(doctor2)
        .requestEmergencyAccess(patient1Pseudonym, sampleRecordId, justification);

      await expect(tx)
        .to.emit(consentManager, "EmergencyAccessRequested");

      const [hasAccess, isEmergency, reason] = await consentManager.checkAccess(
        patient1Pseudonym,
        sampleRecordId,
        doctor2.address
      );
      expect(hasAccess).to.be.true;
      expect(isEmergency).to.be.true;
      expect(reason).to.equal(justification);

      const emergencyIds = await consentManager.getPatientEmergencyAccesses(patient1Pseudonym);
      expect(emergencyIds.length).to.equal(1);

      const allEmergency = await consentManager.getAllEmergencyAccessIds();
      expect(allEmergency.length).to.equal(1);

      await expect(consentManager.connect(patient1).acknowledgeEmergencyAccess(emergencyIds[0]))
        .to.emit(consentManager, "EmergencyAccessAcknowledged");

      const ea = await consentManager.getEmergencyAccess(emergencyIds[0]);
      expect(ea.acknowledged).to.be.true;
    });

    it("should reject non-doctor from requesting emergency break-glass", async function () {
      await expect(
        consentManager
          .connect(unauthorizedUser)
          .requestEmergencyAccess(patient1Pseudonym, sampleRecordId, "Malicious request")
      ).to.be.revertedWithCustomError(consentManager, "UnauthorizedDoctor");
    });

    it("should enforce pause controls on consent manager", async function () {
      await consentManager.connect(admin).pause();
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 86400;
      await expect(
        consentManager.connect(patient1).grantAccess(patient1Pseudonym, hospital2.address, sampleRecordId, 0, validUntil)
      ).to.be.revertedWithCustomError(consentManager, "EnforcedPause");

      await consentManager.connect(admin).unpause();
      await expect(
        consentManager.connect(patient1).grantAccess(patient1Pseudonym, hospital2.address, sampleRecordId, 0, validUntil)
      ).to.emit(consentManager, "ConsentGranted");
    });
  });

  describe("4. AuditLog & Access Trail", function () {
    it("should capture and index entries across all core actions", async function () {
      const initialCount = await auditLog.getAuditEntryCount();
      expect(initialCount).to.equal(0n);

      await hospitalRegistry.connect(admin).registerHospital(hospital1.address, "Metro Health", dummyPublicKey1);
      await hospitalRegistry.connect(hospital1).registerDoctor(doctor1.address, "Dr. Sarah", "LIC-1");

      const plainHash = ethers.sha256(ethers.toUtf8Bytes("Prescription"));
      const sig = await doctor1.signMessage(ethers.getBytes(plainHash));
      await recordRegistry.connect(doctor1).addRecord(patient1Pseudonym, plainHash, plainHash, 2, sig, "storage/rx.enc");

      const countAfterUpload = await auditLog.getAuditEntryCount();
      expect(countAfterUpload > 0n).to.be.true;

      const entry = await auditLog.getAuditEntry(0);
      expect(entry.action).to.equal("RECORD_UPLOADED");
      expect(entry.actor).to.equal(doctor1.address);
      expect(entry.hospital).to.equal(hospital1.address);

      const recordIndices = await auditLog.getAuditIndicesByRecord(entry.recordId);
      expect(recordIndices.length).to.equal(1);

      const patientIndices = await auditLog.getAuditIndicesByPatient(patient1Pseudonym);
      expect(patientIndices.length).to.equal(1);
    });

    it("should allow recorder role to log access attempts, integrity verifications", async function () {
      const sampleId = ethers.keccak256(ethers.toUtf8Bytes("SAMPLE_RECORD"));
      
      await expect(
        auditLog.connect(admin).logAccessAttempted(sampleId, patient1Pseudonym, doctor1.address, hospital1.address, true, "VIEW", "Routine consult")
      ).to.emit(auditLog, "AccessAttempted");

      await expect(
        auditLog.connect(admin).logIntegrityVerified(sampleId, unauthorizedUser.address, true)
      ).to.emit(auditLog, "IntegrityVerified");
    });

    it("should reject direct entry modification by unauthorized external address", async function () {
      await expect(
        auditLog
          .connect(unauthorizedUser)
          .logRecordUploaded(ethers.ZeroHash, ethers.ZeroHash, hospital1.address, doctor1.address, 1)
      ).to.be.revertedWithCustomError(auditLog, "UnauthorizedCaller");
    });
  });
});
