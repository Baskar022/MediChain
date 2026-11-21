import { ethers } from "ethers";

export type StaffRole = "DOCTOR" | "LAB_TECH" | "INSTITUTION_ADMIN";
export type StaffStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface StaffProfile {
  wallet: string;
  institutionId: string;
  role: StaffRole;
  roleHash: string;
  name: string;
  licenseNumber: string;
  status: StaffStatus;
  registeredAt: number;
  updatedAt: number;
  revocationReason?: string;
}

export const ROLE_HASHES: Record<StaffRole, string> = {
  DOCTOR: ethers.keccak256(ethers.toUtf8Bytes("DOCTOR_ROLE")),
  LAB_TECH: ethers.keccak256(ethers.toUtf8Bytes("LAB_TECH_ROLE")),
  INSTITUTION_ADMIN: ethers.keccak256(ethers.toUtf8Bytes("INSTITUTION_ADMIN_ROLE")),
};

/**
 * StaffManager
 * Manages institution medical staff (Doctors, Lab Technicians, Admins),
 * enforces on-chain role checks via StaffRegistry contract,
 * and executes instant revocation.
 */
export class StaffManager {
  private staffProfiles: Map<string, StaffProfile> = new Map();
  private contractsByInstitution: Map<string, ethers.Contract> = new Map();

  constructor() {}

  /**
   * Optionally registers an on-chain StaffRegistry contract for an institution.
   */
  public registerContract(institutionId: string, contract: ethers.Contract): void {
    this.contractsByInstitution.set(institutionId.toLowerCase(), contract);
  }

  /**
   * Registers a new clinical staff member (doctor or lab technician).
   * Persists on-chain if contract is configured, and indexes locally.
   */
  public async registerStaff(
    institutionId: string,
    wallet: string,
    role: StaffRole,
    name: string,
    licenseNumber: string,
    callerSigner?: ethers.Signer
  ): Promise<StaffProfile> {
    const key = `${institutionId.toLowerCase()}:${wallet.toLowerCase()}`;
    if (this.staffProfiles.has(key) && this.staffProfiles.get(key)!.status === "ACTIVE") {
      throw new Error(`Staff member with wallet ${wallet} already active at institution ${institutionId}`);
    }

    const roleHash = ROLE_HASHES[role];
    const contract = this.contractsByInstitution.get(institutionId.toLowerCase());

    if (contract && callerSigner) {
      const connected = contract.connect(callerSigner) as any;
      const tx = await connected.registerStaff(wallet, roleHash, name, licenseNumber);
      await tx.wait();
    }

    const now = Math.floor(Date.now() / 1000);
    const profile: StaffProfile = {
      wallet: ethers.getAddress(wallet),
      institutionId: institutionId.toLowerCase(),
      role,
      roleHash,
      name,
      licenseNumber,
      status: "ACTIVE",
      registeredAt: now,
      updatedAt: now,
    };

    this.staffProfiles.set(key, profile);
    return profile;
  }

  /**
   * Instantly revokes a staff member's privileges.
   * Immediately invalidates access on-chain and in API memory.
   */
  public async revokeStaff(
    institutionId: string,
    wallet: string,
    reason: string,
    callerSigner?: ethers.Signer
  ): Promise<StaffProfile> {
    const key = `${institutionId.toLowerCase()}:${wallet.toLowerCase()}`;
    const profile = this.staffProfiles.get(key);
    if (!profile) {
      throw new Error(`Staff member ${wallet} not found at institution ${institutionId}`);
    }

    const contract = this.contractsByInstitution.get(institutionId.toLowerCase());
    if (contract && callerSigner) {
      const connected = contract.connect(callerSigner) as any;
      const tx = await connected.revokeStaff(wallet, reason);
      await tx.wait();
    }

    profile.status = "REVOKED";
    profile.revocationReason = reason;
    profile.updatedAt = Math.floor(Date.now() / 1000);

    return profile;
  }

  /**
   * Suspends a staff member temporarily.
   */
  public async suspendStaff(
    institutionId: string,
    wallet: string,
    reason: string,
    callerSigner?: ethers.Signer
  ): Promise<StaffProfile> {
    const key = `${institutionId.toLowerCase()}:${wallet.toLowerCase()}`;
    const profile = this.staffProfiles.get(key);
    if (!profile) {
      throw new Error(`Staff member ${wallet} not found at institution ${institutionId}`);
    }

    const contract = this.contractsByInstitution.get(institutionId.toLowerCase());
    if (contract && callerSigner) {
      const connected = contract.connect(callerSigner) as any;
      const tx = await connected.suspendStaff(wallet, reason);
      await tx.wait();
    }

    profile.status = "SUSPENDED";
    profile.revocationReason = reason;
    profile.updatedAt = Math.floor(Date.now() / 1000);

    return profile;
  }

  /**
   * Checks if a staff member holds an active role on-chain and in API.
   * If revoked, instantly returns false.
   */
  public async isStaffActive(institutionId: string, wallet: string, requiredRole?: StaffRole): Promise<boolean> {
    const key = `${institutionId.toLowerCase()}:${wallet.toLowerCase()}`;
    const profile = this.staffProfiles.get(key);

    if (!profile || profile.status !== "ACTIVE") {
      return false;
    }

    if (requiredRole && profile.role !== requiredRole) {
      return false;
    }

    // Check on-chain if contract is connected
    const contract = this.contractsByInstitution.get(institutionId.toLowerCase());
    if (contract) {
      try {
        const roleHash = requiredRole ? ROLE_HASHES[requiredRole] : profile.roleHash;
        const isActive = await contract.isStaffActive(wallet, roleHash);
        if (!isActive) {
          // On-chain status revoked: synchronize local state immediately
          profile.status = "REVOKED";
          return false;
        }
      } catch (err: any) {
        console.warn("On-chain staff role check failed, falling back to cached profile:", err.message);
      }
    }

    return true;
  }

  /**
   * Lists all staff registered under an institution.
   */
  public listStaff(institutionId: string): StaffProfile[] {
    const targetInst = institutionId.toLowerCase();
    const result: StaffProfile[] = [];
    for (const [key, profile] of this.staffProfiles.entries()) {
      if (key.startsWith(targetInst + ":")) {
        result.push(profile);
      }
    }
    return result;
  }

  /**
   * Retrieves profile by wallet.
   */
  public getStaff(institutionId: string, wallet: string): StaffProfile | undefined {
    const key = `${institutionId.toLowerCase()}:${wallet.toLowerCase()}`;
    return this.staffProfiles.get(key);
  }
}
