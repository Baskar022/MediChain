import { expect } from "chai";
import { ethers } from "ethers";
import {
  deriveGlobalPatientId,
  deriveLocalPatientPseudonym,
  createPatientRegistrationLinkMessage,
  verifyPatientRegistrationBinding,
  PatientRegistrationBinding,
} from "../../../../../interop/types/identity";
import {
  upsertRecordLocator,
  getPatientRecordLocations,
  setPatientLocatorVisibility,
  isPatientLocatorHidden,
} from "../../locator/service";
import { DatabaseService } from "../../db/service";

describe("Phase F-3: Identity, Patient Binding & Record Locator Index", () => {
  const patientWallet = ethers.Wallet.createRandom();
  const staffWallet = ethers.Wallet.createRandom();
  const hospitalId = "hospital-sepolia-01";
  const globalPatientId = deriveGlobalPatientId("NATIONAL-ID-987654321");

  describe("1. In-Person Patient Registration & Cryptographic Binding", () => {
    it("should generate deterministic GPI and localized pseudonyms", () => {
      const gpi1 = deriveGlobalPatientId("NATIONAL-ID-987654321");
      const gpi2 = deriveGlobalPatientId("national-id-987654321");
      expect(gpi1).to.equal(gpi2);

      const local1 = deriveLocalPatientPseudonym(gpi1, "hospital-sepolia-01");
      const local2 = deriveLocalPatientPseudonym(gpi1, "hospital-amoy-02");
      expect(local1).to.not.equal(local2);
      expect(local1).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should generate and verify in-person patient registration binding", async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const linkMessage = createPatientRegistrationLinkMessage(globalPatientId, hospitalId, timestamp);

      // Patient signs link message
      const patientSig = await patientWallet.signMessage(linkMessage);

      // Staff countersigns verified-in-person message
      const staffMessage = `${linkMessage}\nVerified in-person by staff: ${staffWallet.address.toLowerCase()}`;
      const staffCountersig = await staffWallet.signMessage(staffMessage);

      const binding: PatientRegistrationBinding = {
        globalPatientId,
        institutionId: hospitalId,
        patientWallet: patientWallet.address,
        staffWallet: staffWallet.address,
        linkMessage,
        patientSignature: patientSig,
        institutionCountersignature: staffCountersig,
        verifiedAt: timestamp,
      };

      const isValid = verifyPatientRegistrationBinding(binding);
      expect(isValid).to.be.true;
    });

    it("should reject forged patient binding or imposter staff signature", async () => {
      const attackerWallet = ethers.Wallet.createRandom();
      const timestamp = Math.floor(Date.now() / 1000);
      const linkMessage = createPatientRegistrationLinkMessage(globalPatientId, hospitalId, timestamp);

      const patientSig = await patientWallet.signMessage(linkMessage);
      const forgedStaffSig = await attackerWallet.signMessage(
        `${linkMessage}\nVerified in-person by staff: ${staffWallet.address.toLowerCase()}`
      );

      const invalidBinding: PatientRegistrationBinding = {
        globalPatientId,
        institutionId: hospitalId,
        patientWallet: patientWallet.address,
        staffWallet: staffWallet.address,
        linkMessage,
        patientSignature: patientSig,
        institutionCountersignature: forgedStaffSig,
        verifiedAt: timestamp,
      };

      const isValid = verifyPatientRegistrationBinding(invalidBinding);
      expect(isValid).to.be.false;
    });
  });

  describe("2. Record Locator Service & Privacy Opt-Out", () => {
    it("should index record locations across multiple institutions without PHI", () => {
      upsertRecordLocator(
        globalPatientId,
        "hosp-sepolia",
        "City General Hospital",
        "11155111",
        "EVM_SEPOLIA",
        "CONSULTATION",
        3
      );
      upsertRecordLocator(
        globalPatientId,
        "lab-algorand",
        "Metro Diagnostic Lab",
        "algorand-testnet",
        "ALGORAND",
        "LAB_RESULT",
        1
      );

      const locations = getPatientRecordLocations(globalPatientId);
      expect(locations).to.have.lengthOf(2);
      expect(locations[0].institutionName).to.equal("City General Hospital");
      expect(locations[0].recordCount).to.equal(3);
      expect(locations[1].institutionName).to.equal("Metro Diagnostic Lab");
    });

    it("should allow patient to opt out / hide locator index from federated search", () => {
      expect(isPatientLocatorHidden(globalPatientId)).to.be.false;

      // Patient hides locator
      setPatientLocatorVisibility(globalPatientId, false);
      expect(isPatientLocatorHidden(globalPatientId)).to.be.true;

      // Querying hidden locator must throw/reject
      expect(() => getPatientRecordLocations(globalPatientId)).to.throw(
        "Patient has chosen to hide their record locator index"
      );

      // Patient unhides locator
      setPatientLocatorVisibility(globalPatientId, true);
      expect(isPatientLocatorHidden(globalPatientId)).to.be.false;
      const locations = getPatientRecordLocations(globalPatientId);
      expect(locations).to.have.lengthOf(2);
    });
  });

  describe("3. Database Service Driver Resolution", () => {
    it("should report active database driver and status correctly", () => {
      const status = DatabaseService.getStatus();
      expect(status.isConnected).to.be.true;
      expect(["NEON_POSTGRESQL", "SQLITE_LOCAL"]).to.include(status.driver);
      expect(status.target).to.be.a("string").that.is.not.empty;
    });
  });
});
