import { ethers } from "ethers";

export type FederationMemberStatus = "APPLIED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type FederationChainType = "EVM" | "ALGORAND" | "FABRIC" | "PERMISSIONED_LEDGER";
export type FederationInstitutionType = "HOSPITAL" | "LAB" | "CLINIC";

export interface FederationMember {
  institutionId: string;
  name: string;
  institutionType: FederationInstitutionType;
  chainType: FederationChainType;
  chainId: string;
  gatewayEndpoint: string;
  gatewayPublicKey: string;
  gatewayAddress: string;
  status: FederationMemberStatus;
  trustLevel: number; // 1-5
  onboardedAt: number;
  updatedAt?: number;
  licenseNumberHash?: string;
  documentHash?: string; // IPFS CID of accreditation documents
  rejectionReason?: string;
}

export interface RecordLocatorItem {
  institutionId: string;
  institutionName: string;
  chainIdentifier: string;
  chainType: FederationChainType;
  recordType: string;
  recordCount: number;
  lastUpdatedAt: number;
}

export interface CachedStatusEntry {
  status: FederationMemberStatus;
  trustLevel: number;
  cachedAt: number;
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
    chainId: "11155111", // Sepolia
    gatewayEndpoint: "http://localhost:8545",
    gatewayPublicKey: "0x04a298bfd4695e1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    gatewayAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    status: "ACTIVE",
    trustLevel: 5,
    onboardedAt: 1704067200,
    licenseNumberHash: ethers.keccak256(ethers.toUtf8Bytes("LIC-CITY-GEN-001")),
    documentHash: "ipfs://QmCityGenAccreditationDocHash123",
  },
  {
    institutionId: ethers.keccak256(ethers.toUtf8Bytes("HOSPITAL-REGIONAL-SPECIALTY")),
    name: "Regional Specialty Hospital",
    institutionType: "HOSPITAL",
    chainType: "EVM",
    chainId: "80002", // Polygon Amoy
    gatewayEndpoint: "http://localhost:8546",
    gatewayPublicKey: "0x04df987aa810c91234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    gatewayAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    status: "ACTIVE",
    trustLevel: 5,
    onboardedAt: 1704067200,
    licenseNumberHash: ethers.keccak256(ethers.toUtf8Bytes("LIC-REG-SPEC-002")),
    documentHash: "ipfs://QmRegionalSpecAccreditationDocHash456",
  },
  {
    institutionId: ethers.keccak256(ethers.toUtf8Bytes("LAB-METRO-DIAGNOSTICS")),
    name: "Metro Diagnostics Lab",
    institutionType: "LAB",
    chainType: "PERMISSIONED_LEDGER", // Non-EVM ledger / Algorand AVM
    chainId: "METRO-LAB-CHAIN-C",
    gatewayEndpoint: "http://localhost:9000",
    gatewayPublicKey: "0x04889c104e76a01234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    gatewayAddress: "0x976EA74026E72CD55542b2494463435b3dA39125",
    status: "ACTIVE",
    trustLevel: 4,
    onboardedAt: 1704067200,
    licenseNumberHash: ethers.keccak256(ethers.toUtf8Bytes("LIC-METRO-LAB-003")),
    documentHash: "ipfs://QmMetroLabAccreditationDocHash789",
  },
];

/**
 * FederationManager
 * Manages the neutral trust layer, member institution directory,
 * gateway authentication keys, short-TTL authorization cache,
 * and the privacy-preserving Record Locator Index.
 */
export class FederationManager {
  private members: Map<string, FederationMember> = new Map();
  private recordLocators: Map<string, RecordLocatorItem[]> = new Map();
  private patientOptOuts: Set<string> = new Set();
  
  // Short-TTL cache for gateway verification (default: 30 seconds)
  private statusCache: Map<string, CachedStatusEntry> = new Map();
  private cacheTtlMs: number;

  // Optional on-chain FederationRegistry contract instance
  private onChainContract?: ethers.Contract;

  constructor(initialMembers?: FederationMember[], cacheTtlMs: number = 30000, onChainContract?: ethers.Contract) {
    this.cacheTtlMs = cacheTtlMs;
    this.onChainContract = onChainContract;
    const list = initialMembers || DEFAULT_FEDERATION_MEMBERS;
    for (const member of list) {
      this.members.set(member.institutionId.toLowerCase(), { ...member });
    }
  }

  /**
   * Submits a formal application for a new institution to join the consortium.
   * Lifecycle moves to APPLIED pending Safe multisig review.
   */
  public applyMember(application: Omit<FederationMember, "status" | "onboardedAt" | "trustLevel">): FederationMember {
    const id = application.institutionId.toLowerCase();
    if (this.members.has(id)) {
      throw new Error(`Institution ${application.name} (${application.institutionId}) already exists in registry`);
    }

    const member: FederationMember = {
      ...application,
      status: "APPLIED",
      trustLevel: 1,
      onboardedAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    this.members.set(id, member);
    this.invalidateCache(id);
    return member;
  }

  /**
   * Approves a pending application. Executed via Safe 2-of-3 multisig.
   */
  public approveMember(institutionId: string, trustLevel: number = 3): FederationMember {
    const id = institutionId.toLowerCase();
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member ${institutionId} not found`);
    }
    if (existing.status !== "APPLIED" && existing.status !== "SUSPENDED") {
      throw new Error(`Cannot approve institution with status ${existing.status}`);
    }

    existing.status = "ACTIVE";
    existing.trustLevel = Math.max(1, Math.min(5, trustLevel));
    existing.updatedAt = Math.floor(Date.now() / 1000);

    this.invalidateCache(id);
    return existing;
  }

  /**
   * Suspends an active institution (compliance inquiry / compromised key).
   */
  public suspendMember(institutionId: string, reason: string): FederationMember {
    const id = institutionId.toLowerCase();
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member ${institutionId} not found`);
    }

    existing.status = "SUSPENDED";
    existing.rejectionReason = reason;
    existing.updatedAt = Math.floor(Date.now() / 1000);

    this.invalidateCache(id);
    return existing;
  }

  /**
   * Permanently removes an institution from the federation.
   */
  public removeMember(institutionId: string, reason: string): FederationMember {
    const id = institutionId.toLowerCase();
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member ${institutionId} not found`);
    }

    existing.status = "REMOVED";
    existing.rejectionReason = reason;
    existing.updatedAt = Math.floor(Date.now() / 1000);

    this.invalidateCache(id);
    return existing;
  }

  /**
   * Direct onboarding for pre-vetted or genesis members.
   */
  public onboardMember(member: FederationMember): void {
    const id = member.institutionId.toLowerCase();
    if (this.members.has(id)) {
      throw new Error(`Member ${member.name} (${member.institutionId}) already exists`);
    }
    this.members.set(id, { ...member });
    this.invalidateCache(id);
  }

  /**
   * Updates an institution's status directly.
   */
  public updateMemberStatus(institutionId: string, status: FederationMemberStatus): void {
    const id = institutionId.toLowerCase();
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member ${institutionId} not found`);
    }
    existing.status = status;
    existing.updatedAt = Math.floor(Date.now() / 1000);
    this.invalidateCache(id);
  }

  /**
   * Rotates an institution's gateway public key and optionally address.
   */
  public updateGatewayKey(institutionId: string, newPublicKey: string, newAddress?: string): void {
    const id = institutionId.toLowerCase();
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member ${institutionId} not found`);
    }
    existing.gatewayPublicKey = newPublicKey;
    if (newAddress) existing.gatewayAddress = newAddress;
    existing.updatedAt = Math.floor(Date.now() / 1000);
    this.invalidateCache(id);
  }

  /**
   * Retrieves single member details.
   */
  public getMember(institutionId: string): FederationMember | undefined {
    return this.members.get(institutionId.toLowerCase());
  }

  /**
   * Retrieves all members regardless of status.
   */
  public getAllMembers(): FederationMember[] {
    return Array.from(this.members.values());
  }

  /**
   * Retrieves all pending applications for the Federation Review Queue.
   */
  public getPendingApplications(): FederationMember[] {
    return Array.from(this.members.values()).filter((m) => m.status === "APPLIED");
  }

  /**
   * High-performance status check using Short-TTL cache.
   * Every gateway calls this on incoming & outgoing cross-chain envelopes.
   */
  public isMemberActive(institutionId: string): boolean {
    const id = institutionId.toLowerCase();
    const now = Date.now();
    const cached = this.statusCache.get(id);

    if (cached && now - cached.cachedAt < this.cacheTtlMs) {
      return cached.status === "ACTIVE";
    }

    const member = this.getMember(id);
    const status: FederationMemberStatus = member ? member.status : "REMOVED";
    const trustLevel = member ? member.trustLevel : 0;

    this.statusCache.set(id, {
      status,
      trustLevel,
      cachedAt: now,
    });

    return status === "ACTIVE";
  }

  /**
   * Invalidates short-TTL cache entry.
   */
  public invalidateCache(institutionId?: string): void {
    if (institutionId) {
      this.statusCache.delete(institutionId.toLowerCase());
    } else {
      this.statusCache.clear();
    }
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

  /**
   * Synchronizes state from an on-chain Sepolia FederationRegistry contract.
   */
  public async syncWithOnChainRegistry(): Promise<void> {
    if (!this.onChainContract) return;

    try {
      const count = await this.onChainContract.getInstitutionCount();
      const ids: string[] = await this.onChainContract.getAllInstitutionIds();

      const statusMap: Record<number, FederationMemberStatus> = {
        0: "REMOVED",   // Inactive
        1: "ACTIVE",    // Active
        2: "SUSPENDED", // Suspended
        3: "REMOVED",   // Removed
        4: "APPLIED",   // Applied
      };

      const chainTypeMap: Record<number, FederationChainType> = {
        0: "EVM",
        1: "ALGORAND",
        2: "FABRIC",
        3: "PERMISSIONED_LEDGER",
      };

      const instTypeMap: Record<number, FederationInstitutionType> = {
        0: "HOSPITAL",
        1: "LAB",
        2: "CLINIC",
      };

      for (const id of ids) {
        const inst = await this.onChainContract.getInstitution(id);
        const member: FederationMember = {
          institutionId: inst.institutionId,
          name: inst.name,
          institutionType: instTypeMap[Number(inst.institutionType)] || "HOSPITAL",
          chainType: chainTypeMap[Number(inst.chainType)] || "EVM",
          chainId: inst.chainId,
          gatewayEndpoint: inst.gatewayEndpoint,
          gatewayPublicKey: inst.gatewayPublicKey,
          gatewayAddress: ethers.computeAddress(inst.gatewayPublicKey.startsWith("0x04") ? inst.gatewayPublicKey : "0x04" + inst.gatewayPublicKey.slice(2)),
          status: statusMap[Number(inst.status)] || "ACTIVE",
          trustLevel: Number(inst.trustLevel),
          onboardedAt: Number(inst.onboardedAt),
          updatedAt: Number(inst.updatedAt),
          licenseNumberHash: inst.licenseNumberHash,
          documentHash: inst.documentHash,
        };

        this.members.set(member.institutionId.toLowerCase(), member);
        this.invalidateCache(member.institutionId);
      }
    } catch (err: any) {
      console.warn("Could not sync with on-chain FederationRegistry:", err.message);
    }
  }
}
