import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import { FederationRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FederationRegistry Smart Contract", () => {
  let federationRegistry: FederationRegistry;
  let admin: SignerWithAddress;
  let nonAdmin: SignerWithAddress;
  let hospitalSigner: SignerWithAddress;

  const instA_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL"));
  const instB_Id = ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY"));
  const instC_Id = ethers.keccak256(ethers.toUtf8Bytes("LAB-METRO-DIAGNOSTICS"));

  const samplePubKeyA = ethers.hexlify(ethers.toUtf8Bytes("GATEWAY_A_SECP256K1_PUBKEY_MOCK"));
  const samplePubKeyB = ethers.hexlify(ethers.toUtf8Bytes("GATEWAY_B_SECP256K1_PUBKEY_MOCK"));

  beforeEach(async () => {
    [admin, nonAdmin, hospitalSigner] = await ethers.getSigners();

    const FederationFactory = await ethers.getContractFactory("FederationRegistry");
    federationRegistry = (await FederationFactory.deploy(admin.address)) as unknown as FederationRegistry;
    await federationRegistry.waitForDeployment();
  });

  describe("1. Institution Onboarding & Federation Directory", () => {
    it("should allow federation admin to onboard an autonomous EVM hospital", async () => {
      const tx = await federationRegistry.onboardInstitution(
        instA_Id,
        "City General Hospital",
        0, // Hospital
        0, // Evm
        "31337",
        "http://localhost:8545",
        samplePubKeyA,
        5 // Trust Level
      );

      await expect(tx)
        .to.emit(federationRegistry, "InstitutionOnboarded")
        .withArgs(instA_Id, "City General Hospital", 0, 0, "31337", samplePubKeyA, 5, (await ethers.provider.getBlock("latest"))!.timestamp);

      const inst = await federationRegistry.getInstitution(instA_Id);
      expect(inst.name).to.equal("City General Hospital");
      expect(inst.trustLevel).to.equal(5);
      expect(inst.status).to.equal(1); // Active
      expect(await federationRegistry.isInstitutionActive(instA_Id)).to.be.true;
    });

    it("should allow onboarding of non-EVM permissioned lab (Network C)", async () => {
      await federationRegistry.onboardInstitution(
        instC_Id,
        "Metro Diagnostics Lab",
        1, // Lab
        1, // PermissionedLedger
        "METRO-LAB-CHAIN-C",
        "http://localhost:9000",
        samplePubKeyB,
        4
      );

      const inst = await federationRegistry.getInstitution(instC_Id);
      expect(inst.institutionType).to.equal(1); // Lab
      expect(inst.chainType).to.equal(1); // PermissionedLedger
      expect(inst.chainId).to.equal("METRO-LAB-CHAIN-C");
    });

    it("should reject non-admin from onboarding an institution", async () => {
      await expect(
        federationRegistry.connect(nonAdmin).onboardInstitution(
          instB_Id,
          "Rogue Hospital",
          0,
          0,
          "31338",
          "http://localhost:8546",
          samplePubKeyB,
          1
        )
      ).to.be.revertedWithCustomError(federationRegistry, "UnauthorizedCaller");
    });

    it("should reject duplicate institution onboarding", async () => {
      await federationRegistry.onboardInstitution(
        instA_Id,
        "City General Hospital",
        0,
        0,
        "31337",
        "http://localhost:8545",
        samplePubKeyA,
        5
      );

      await expect(
        federationRegistry.onboardInstitution(
          instA_Id,
          "City General Duplicate",
          0,
          0,
          "31337",
          "http://localhost:8545",
          samplePubKeyA,
          5
        )
      ).to.be.revertedWithCustomError(federationRegistry, "InstitutionAlreadyExists");
    });
  });

  describe("2. Institution Lifecycle: Suspension & Key Rotation", () => {
    beforeEach(async () => {
      await federationRegistry.onboardInstitution(
        instA_Id,
        "City General Hospital",
        0,
        0,
        "31337",
        "http://localhost:8545",
        samplePubKeyA,
        5
      );
    });

    it("should allow admin to suspend and reactivate a member institution", async () => {
      // Suspend
      await federationRegistry.updateInstitutionStatus(instA_Id, 2); // Suspended
      expect(await federationRegistry.isInstitutionActive(instA_Id)).to.be.false;

      // Reactivate
      await federationRegistry.updateInstitutionStatus(instA_Id, 1); // Active
      expect(await federationRegistry.isInstitutionActive(instA_Id)).to.be.true;
    });

    it("should allow gateway public key rotation", async () => {
      const newKey = ethers.hexlify(ethers.toUtf8Bytes("NEW_ROTATED_KEY_123456789"));
      await federationRegistry.updateGatewayPublicKey(instA_Id, newKey);

      const inst = await federationRegistry.getInstitution(instA_Id);
      expect(inst.gatewayPublicKey).to.equal(newKey);
    });
  });

  describe("3. Privacy-Preserving Record Locator Index", () => {
    const globalPatientId = ethers.keccak256(ethers.toUtf8Bytes("PATIENT_GLOBAL_ALICE_VANCE"));

    beforeEach(async () => {
      await federationRegistry.onboardInstitution(
        instA_Id,
        "City General Hospital",
        0,
        0,
        "31337",
        "http://localhost:8545",
        samplePubKeyA,
        5
      );
      await federationRegistry.onboardInstitution(
        instC_Id,
        "Metro Diagnostics Lab",
        1,
        1,
        "METRO-LAB-CHAIN-C",
        "http://localhost:9000",
        samplePubKeyB,
        4
      );
    });

    it("should index where records exist across sovereign chains without PHI", async () => {
      // City General records: Cardiology (2 records)
      await federationRegistry.updateRecordLocator(
        globalPatientId,
        instA_Id,
        "NETWORK-A-CITY-GENERAL",
        "CARDIOLOGY",
        2
      );

      // Metro Lab records: Blood panel (3 records)
      await federationRegistry.updateRecordLocator(
        globalPatientId,
        instC_Id,
        "NETWORK-C-METRO-LAB",
        "HEMATOLOGY",
        3
      );

      const locator = await federationRegistry.getRecordLocator(globalPatientId);
      expect(locator.length).to.equal(2);
      expect(locator[0].institutionId).to.equal(instA_Id);
      expect(locator[0].recordType).to.equal("CARDIOLOGY");
      expect(locator[0].recordCount).to.equal(2n);

      expect(locator[1].institutionId).to.equal(instC_Id);
      expect(locator[1].recordType).to.equal("HEMATOLOGY");
      expect(locator[1].recordCount).to.equal(3n);
    });

    it("should allow patient to opt out / hide locator index", async () => {
      await federationRegistry.updateRecordLocator(
        globalPatientId,
        instA_Id,
        "NETWORK-A-CITY-GENERAL",
        "CARDIOLOGY",
        1
      );

      // Patient hides locator
      await federationRegistry.setPatientVisibility(globalPatientId, false);

      await expect(
        federationRegistry.getRecordLocator(globalPatientId)
      ).to.be.revertedWithCustomError(federationRegistry, "PatientLocatorHidden");

      // Patient unhides locator
      await federationRegistry.setPatientVisibility(globalPatientId, true);
      const locator = await federationRegistry.getRecordLocator(globalPatientId);
      expect(locator.length).to.equal(1);
    });
  });
});
