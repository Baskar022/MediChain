import { ethers } from "ethers";

export interface FederationMember {
  institutionId: string;
  name: string;
  institutionType: "HOSPITAL" | "LAB" | "CLINIC";
  chainType: "EVM" | "PERMISSIONED_LEDGER";
  chainId: string;
  gatewayEndpoint: string;
  gatewayPublicKey: string;
  gatewayAddress: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  trustLevel: number; // 1-5
  onboardedAt: number;
}

export interface RecordLocatorItem {
  institutionId: string;
  institutionName: string;
  chainIdentifier: string;
  chainType: "EVM" | "PERMISSIONED_LEDGER";
  recordType: string;
  recordCount: number;
  lastUpdatedAt: number;
}

/**
 * Standard Default Initial Consortium Members
 */
export const DEFAULT_FEDERATION_MEMBERS: FederationMember[] = [
  {
    institutionId: ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-CITY-GENERAL")),
    name: "City General Hospital",
    institutionType: "HOSPITAL",
    chainType: "EVM",
    chainId: "31337",
    gatewayEndpoint: "http://localhost:8545",
    gatewayPublicKey: "0x04a298bfd4695e1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    gatewayAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    status: "ACTIVE",
    trustLevel: 5,
    onboardedAt: 1704067200,
  },
  {
    institutionId: ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY")),
    name: "Regional Specialty Hospital",
    institutionType: "HOSPITAL",
    chainType: "EVM",
    chainId: "31338",
    gatewayEndpoint: "http://localhost:8546",
    gatewayPublicKey: "0x04df987aa810c91234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    gatewayAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    status: "ACTIVE",
    trustLevel: 5,
    onboardedAt: 1704067200,
  },
  {
    institutionId: ethers.keccak256(ethers.toUtf8Bytes("LAB-METRO-DIAGNOSTICS")),
    name: "Metro Diagnostics Lab",
    institutionType: "LAB",
    chainType: "PERMISSIONED_LEDGER",
    chainId: "METRO-LAB-CHAIN-C",
    gatewayEndpoint: "http://localhost:9000",
    gatewayPublicKey: "0x04889c104e76a01234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    gatewayAddress: "0x976EA74026E72CD55542b2494463435b3dA39125",
    status: "ACTIVE",
    trustLevel: 4,
    onboardedAt: 1704067200,
  },
];

/**
 * FederationManager
 * Manages the neutral trust layer, member institution directory,
 * gateway authentication keys, and the privacy-preserving Record Locator Index.
 */
export class FederationManager {
  private members: Map<string, FederationMember> = new Map();
  private recordLocators: Map<string, RecordLocatorItem[]> = new Map();
  private patientOptOuts: Set<string> = new Set();

  constructor(initialMembers?: FederationMember[]) {
    const list = initialMembers || DEFAULT_FEDERATION_MEMBERS;
    for (const member of list) {
      this.members.set(member.institutionId.toLowerCase(), member);
    }
  }

  public onboardMember(member: FederationMember): void {
    const id = member.institutionId.toLowerCase();
    if (this.members.has(id)) {
      throw new Error(`Member ${member.name} (${member.institutionId}) already exists`);
    }
    this.members.set(id, { ...member });
  }

  public updateMemberStatus(institutionId: string, status: "ACTIVE" | "SUSPENDED" | "REVOKED"): void {
    const id = institutionId.toLowerCase();
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member ${institutionId} not found`);
    }
    existing.status = status;
  }

  public updateGatewayKey(institutionId: string, newPublicKey: string, newAddress?: string): void {
    const id = institutionId.toLowerCase();
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member ${institutionId} not found`);
    }
    existing.gatewayPublicKey = newPublicKey;
    if (newAddress) existing.gatewayAddress = newAddress;
  }

  public getMember(institutionId: string): FederationMember | undefined {
    return this.members.get(institutionId.toLowerCase());
  }

  public getAllMembers(): FederationMember[] {
    return Array.from(this.members.values());
  }

  public isMemberActive(institutionId: string): boolean {
    const member = this.getMember(institutionId);
    return member?.status === "ACTIVE";
  }

  public getMemberByGatewayAddress(address: string): FederationMember | undefined {
    const target = address.toLowerCase();
    for (const member of this.members.values()) {
      if (member.gatewayAddress.toLowerCase() === target) {
        return member;
      }
    }
    return undefined;
  }

  /**
   * Updates the Record Locator Index for a patient without exposing PHI.
   */
  public updateRecordLocator(
    globalPatientId: string,
    institutionId: string,
    chainIdentifier: string,
    recordType: string,
    count: number
  ): void {
    const patientKey = globalPatientId.toLowerCase();
    const inst = this.getMember(institutionId);
    if (!inst || inst.status !== "ACTIVE") {
      throw new Error(`Institution ${institutionId} is not active in the federation`);
    }

    const current = this.recordLocators.get(patientKey) || [];
    const existingIndex = current.findIndex(
      (item) =>
        item.institutionId.toLowerCase() === institutionId.toLowerCase() &&
        item.recordType.toUpperCase() === recordType.toUpperCase()
    );

    const now = Math.floor(Date.now() / 1000);

    if (existingIndex >= 0) {
      current[existingIndex].recordCount = count;
      current[existingIndex].lastUpdatedAt = now;
    } else {
      current.push({
        institutionId: inst.institutionId,
        institutionName: inst.name,
        chainIdentifier,
        chainType: inst.chainType,
        recordType: recordType.toUpperCase(),
        recordCount: count,
        lastUpdatedAt: now,
      });
    }

    this.recordLocators.set(patientKey, current);
  }

  /**
   * Queries where a patient's records reside across all autonomous networks.
   */
  public queryRecordLocator(globalPatientId: string): RecordLocatorItem[] {
    const patientKey = globalPatientId.toLowerCase();
    if (this.patientOptOuts.has(patientKey)) {
      throw new Error("Patient has chosen to hide their record locator index");
    }
    return this.recordLocators.get(patientKey) || [];
  }

  /**
   * Patient privacy opt-out toggle.
   */
  public setPatientVisibility(globalPatientId: string, isVisible: boolean): void {
    const patientKey = globalPatientId.toLowerCase();
    if (isVisible) {
      this.patientOptOuts.delete(patientKey);
    } else {
      this.patientOptOuts.add(patientKey);
    }
  }
}
