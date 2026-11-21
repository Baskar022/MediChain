import { expect } from "chai";
import { ethers } from "hardhat";
import {
  MinimalForwarder,
  ForeignRecordRef,
  StaffRegistry,
  FederationRegistry,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Phase F-1: Advanced Multi-Chain Security Contracts", () => {
  let admin: HardhatEthersSigner;
  let multisigSafe: HardhatEthersSigner;
  let hospitalGateway: HardhatEthersSigner;
  let doctor: HardhatEthersSigner;
  let patient: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  let forwarder: MinimalForwarder;
  let foreignRecordRef: ForeignRecordRef;
  let staffRegistry: StaffRegistry;
  let federationRegistry: FederationRegistry;

  beforeEach(async () => {
    [admin, multisigSafe, hospitalGateway, doctor, patient, stranger] =
      await ethers.getSigners();

    // 1. Deploy MinimalForwarder
    const ForwarderFactory = await ethers.getContractFactory("MinimalForwarder");
    forwarder = (await ForwarderFactory.deploy()) as MinimalForwarder;
    await forwarder.waitForDeployment();

    // 2. Deploy ForeignRecordRef (pointing to forwarder and gateway role)
    const ForeignRefFactory = await ethers.getContractFactory("ForeignRecordRef");
    foreignRecordRef = (await ForeignRefFactory.deploy(
      await forwarder.getAddress(),
      hospitalGateway.address
    )) as ForeignRecordRef;
    await foreignRecordRef.waitForDeployment();

    // 3. Deploy StaffRegistry
    const StaffFactory = await ethers.getContractFactory("StaffRegistry");
    staffRegistry = (await StaffFactory.deploy(
      await forwarder.getAddress(),
      admin.address
    )) as StaffRegistry;
    await staffRegistry.waitForDeployment();

    // 4. Deploy FederationRegistry
    const FedFactory = await ethers.getContractFactory("FederationRegistry");
    federationRegistry = (await FedFactory.deploy(
      admin.address
    )) as FederationRegistry;
    await federationRegistry.waitForDeployment();

    // Grant multisig Safe admin rights
    await federationRegistry.grantRole(
      await federationRegistry.FEDERATION_ADMIN_ROLE(),
      multisigSafe.address
    );
  });

  describe("1. MinimalForwarder (ERC-2771 Sponsored Meta-Transactions)", () => {
    it("should verify valid signed request and track nonce", async () => {
      const forwarderAddress = await forwarder.getAddress();
      const currentNonce = await forwarder.getNonce(patient.address);
      expect(currentNonce).to.equal(0n);

      const domain = {
        name: "MinimalForwarder",
        version: "0.0.1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: forwarderAddress,
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      };

      const req = {
        from: patient.address,
        to: await foreignRecordRef.getAddress(),
        value: 0n,
        gas: 200000n,
        nonce: currentNonce,
        data: "0x",
      };

      const signature = await patient.signTypedData(domain, types, req);
      const isValid = await forwarder.verify(req, signature);
      expect(isValid).to.be.true;
    });
  });

  describe("2. ForeignRecordRef (Cross-Chain Ingest & Proof Anchoring)", () => {
    it("should allow hospital gateway to store cross-chain reference with attestation", async () => {
      const foreignRecordId = ethers.keccak256(ethers.toUtf8Bytes("REC-1001"));
      const patientIdHash = ethers.keccak256(ethers.toUtf8Bytes("PATIENT-ALICE"));
      const originChain = "11155111"; // Sepolia
      const originInstitution = "City General Hospital";
      const recordHash = ethers.keccak256(ethers.toUtf8Bytes("CLINICAL-DATA"));
      const cipherHash = ethers.keccak256(ethers.toUtf8Bytes("ENCRYPTED-PAYLOAD"));
      const storageRef = "ipfs://QmTestCidForeignRecord123456789";
      const attestationSig = ethers.hexlify(ethers.toUtf8Bytes("VALID_ORIGIN_SIGNATURE"));

      const tx = await foreignRecordRef
        .connect(hospitalGateway)
        .registerForeignRecord(
          foreignRecordId,
          patientIdHash,
          originChain,
          originInstitution,
          recordHash,
          cipherHash,
          storageRef,
          attestationSig
        );

      await expect(tx)
        .to.emit(foreignRecordRef, "ForeignRecordRegistered")
        .withArgs(
          foreignRecordId,
          originChain,
          originInstitution,
          recordHash,
          cipherHash,
          storageRef,
          await ethers.provider.getBlock("latest").then((b) => b!.timestamp)
        );

      const ref = await foreignRecordRef.getForeignRecord(foreignRecordId);
      expect(ref.sourceChain).to.equal(originChain);
      expect(ref.sourceInstitution).to.equal(originInstitution);
      expect(ref.patientIdHash).to.equal(patientIdHash);
      expect(ref.recordHash).to.equal(recordHash);
      expect(ref.storageRef).to.equal(storageRef);
      expect(ref.isRevoked).to.be.false;

      // Check existence and validity
      expect(await foreignRecordRef.isForeignRecordValid(foreignRecordId)).to.be.true;

      // Patient records query
      const patientRecords = await foreignRecordRef.getPatientForeignRecords(
        patientIdHash
      );
      expect(patientRecords.length).to.equal(1);
      expect(patientRecords[0]).to.equal(foreignRecordId);
    });

    it("should reject non-gateway caller from storing foreign records", async () => {
      const foreignRecordId = ethers.keccak256(ethers.toUtf8Bytes("REC-ROGUE"));
      await expect(
        foreignRecordRef
          .connect(stranger)
          .registerForeignRecord(
            foreignRecordId,
            ethers.ZeroHash,
            "11155111",
            "Hospital",
            ethers.ZeroHash,
            ethers.ZeroHash,
            "ipfs://test",
            "0x"
          )
      ).to.be.revertedWithCustomError(foreignRecordRef, "AccessControlUnauthorizedAccount");
    });
  });

  describe("3. StaffRegistry (Granular Practitioner Roles & Instant Revocation)", () => {
    it("should allow admin to register and instantly revoke medical staff", async () => {
      const doctorRole = await staffRegistry.DOCTOR_ROLE();

      // Register doctor
      await staffRegistry
        .connect(admin)
        .registerStaff(
          doctor.address,
          doctorRole,
          "Dr. Marcus Brody",
          "LIC-NY-998822"
        );

      expect(await staffRegistry.isStaffActive(doctor.address, doctorRole)).to.be.true;

      // Revoke doctor
      await staffRegistry.connect(admin).revokeStaff(doctor.address, "Transferred to Research");
      expect(await staffRegistry.isStaffActive(doctor.address, doctorRole)).to.be.false;
    });
  });

  describe("4. FederationRegistry Safe Multisig Governance", () => {
    it("should configure Safe multisig role and permit institution application", async () => {
      const instId = ethers.keccak256(ethers.toUtf8Bytes("INST-ST-JUDE"));
      const licenseHash = ethers.keccak256(ethers.toUtf8Bytes("LIC-STATE-1234"));
      const docHash = ethers.keccak256(ethers.toUtf8Bytes("IPFS-DOC-CERT"));
      const pubKey = ethers.hexlify(ethers.toUtf8Bytes("PUBKEY-ST-JUDE-123"));

      // Institution applies
      await federationRegistry
        .connect(stranger)
        .applyInstitution(
          instId,
          "St. Jude Research Hospital",
          0, // Hospital
          1, // Algorand
          "ALGORAND-TESTNET",
          "https://stjude-gateway.org",
          pubKey,
          licenseHash,
          docHash
        );

      const inst = await federationRegistry.getInstitution(instId);
      expect(inst.name).to.equal("St. Jude Research Hospital");
      expect(inst.status).to.equal(4); // Applied

      // Safe multisig approves institution
      await federationRegistry
        .connect(multisigSafe)
        .approveInstitution(
          instId,
          4 // Trust Level 4
        );

      expect(await federationRegistry.isInstitutionActive(instId)).to.be.true;
      const approvedInst = await federationRegistry.getInstitution(instId);
      expect(approvedInst.status).to.equal(1); // Active
      expect(approvedInst.trustLevel).to.equal(4);
    });
  });
});
