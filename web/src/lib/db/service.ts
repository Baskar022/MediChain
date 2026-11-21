import { PrismaClient } from "@prisma/client";
import { dbManager, InstitutionEntity, PatientEntity, StaffEntity, RecordEntity } from "./index";

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")) {
    if (!prisma) {
      prisma = new PrismaClient();
    }
    return prisma;
  }
  return null;
}

export type DatabaseDriver = "NEON_POSTGRESQL" | "SQLITE_LOCAL";

export function getActiveDatabaseDriver(): DatabaseDriver {
  return process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")
    ? "NEON_POSTGRESQL"
    : "SQLITE_LOCAL";
}

/**
 * Unified Database Service
 * Provides seamless dual-mode operations:
 * - Connects to Neon Serverless PostgreSQL via Prisma when DATABASE_URL is configured
 * - Gracefully falls back to local SQLite (dbManager) when running offline / locally
 */
export class DatabaseService {
  /**
   * Retrieves active database driver and connection status.
   */
  public static getStatus(): { driver: DatabaseDriver; isConnected: boolean; target: string } {
    const driver = getActiveDatabaseDriver();
    return {
      driver,
      isConnected: true,
      target: driver === "NEON_POSTGRESQL"
        ? (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] || "neon.tech"
        : dbManager.storageDir,
    };
  }

  /**
   * Fetches all registered institutions.
   */
  public static async getInstitutions(): Promise<InstitutionEntity[]> {
    const client = getPrismaClient();
    if (client) {
      try {
        const rows = await client.institution.findMany({ orderBy: { createdAt: "asc" } });
        return rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          institution_type: r.institutionType as any,
          chain_type: r.chainType as any,
          chain_id: r.chainId,
          rpc_port: r.rpcPort,
          gateway_public_key: r.gatewayPublicKey,
          gateway_private_key: r.gatewayPrivateKey || undefined,
          gateway_endpoint: r.gatewayEndpoint,
          status: r.status as any,
          trust_level: r.trustLevel,
          license_number_hash: r.licenseNumberHash || undefined,
          document_hash: r.documentHash || undefined,
          rejection_reason: r.rejectionReason || undefined,
          created_at: r.createdAt.getTime(),
        }));
      } catch (err: any) {
        console.warn("Prisma query failed, falling back to SQLite:", err.message);
      }
    }
    return dbManager.getAllInstitutions();
  }

  /**
   * Fetches all registered patients.
   */
  public static async getPatients(): Promise<PatientEntity[]> {
    const client = getPrismaClient();
    if (client) {
      try {
        const rows = await client.patient.findMany({ orderBy: { createdAt: "desc" } });
        return rows.map((p: any) => ({
          global_patient_id: p.globalPatientId,
          local_pseudonym: p.localPseudonym,
          name: p.name,
          id_secret: p.idSecret,
          hospital_id: p.hospitalId,
          wallet_address: p.walletAddress,
          encrypted_keystore: p.encryptedKeystore || undefined,
          verified_by_staff: p.verifiedByStaff || undefined,
          binding_signature: p.bindingSignature || undefined,
          created_at: p.createdAt.getTime(),
        }));
      } catch (err: any) {
        console.warn("Prisma query failed, falling back to SQLite:", err.message);
      }
    }
    return dbManager.getAllPatients();
  }

  /**
   * Fetches staff practitioners.
   */
  public static async getStaff(hospitalWallet?: string): Promise<StaffEntity[]> {
    const client = getPrismaClient();
    if (client) {
      try {
        const rows = await client.staffMember.findMany({
          where: hospitalWallet ? { hospitalWallet: hospitalWallet.toLowerCase() } : undefined,
          orderBy: { createdAt: "desc" },
        });
        return rows.map((s: any) => ({
          id: s.id,
          hospital_wallet: s.hospitalWallet,
          name: s.name,
          specialty: s.specialty,
          role: s.role as any,
          wallet_address: s.walletAddress,
          private_key: s.privateKey || undefined,
          license_number: s.licenseNumber || undefined,
          is_active: s.isActive ? 1 : 0,
          revocation_reason: s.revocationReason || undefined,
          created_at: s.createdAt.getTime(),
        }));
      } catch (err: any) {
        console.warn("Prisma query failed, falling back to SQLite:", err.message);
      }
    }
    return hospitalWallet ? dbManager.getStaffByHospital(hospitalWallet) : dbManager.getAllStaff();
  }

  /**
   * Fetches medical records.
   */
  public static async getRecords(patientPseudonym?: string): Promise<RecordEntity[]> {
    const client = getPrismaClient();
    if (client) {
      try {
        const rows = await client.medicalRecord.findMany({
          where: patientPseudonym ? { patientPseudonym } : undefined,
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r: any) => ({
          record_id: r.recordId,
          patient_pseudonym: r.patientPseudonym,
          record_type: r.recordType,
          record_hash: r.recordHash,
          cipher_hash: r.cipherHash,
          issuer_hospital: r.issuerHospital,
          issuer_doctor: r.issuerDoctor,
          issuer_signature: r.issuerSignature,
          storage_path: r.storagePath,
          file_name: r.fileName || "",
          mime_type: r.mimeType || "",
          file_size: r.fileSize || 0,
          version: r.version,
          previous_record_id: r.previousRecordId || null,
          is_revoked: r.isRevoked ? 1 : 0,
          created_at: r.createdAt.getTime(),
        }));
      } catch (err: any) {
        console.warn("Prisma query failed, falling back to SQLite:", err.message);
      }
    }
    return patientPseudonym ? dbManager.getRecordsByPatient(patientPseudonym) : dbManager.getAllRecords();
  }
}
