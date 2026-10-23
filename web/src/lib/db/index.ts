/// <reference path="../../types/sqlite.d.ts" />
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

export interface RecordEntity {
  record_id: string;
  patient_pseudonym: string;
  record_type: string;
  record_hash: string;
  cipher_hash: string;
  issuer_hospital: string;
  issuer_doctor: string;
  issuer_signature: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  version: number;
  previous_record_id?: string | null;
  created_at: number;
  is_revoked: number;
}

export interface WrappedKeyEntity {
  id?: number;
  record_id: string;
  recipient_wallet: string;
  wrapped_key: string;
  created_at: number;
}

export interface AccessRequestEntity {
  id: string;
  patient_pseudonym: string;
  record_id?: string | null;
  requesting_hospital: string;
  requesting_doctor: string;
  reason: string;
  scope: string; // 'SpecificRecord' | 'AllRecords'
  status: string; // 'PENDING' | 'APPROVED' | 'DENIED' | 'REVOKED'
  created_at: number;
  updated_at: number;
}

export interface InstitutionEntity {
  id: string;
  name: string;
  institution_type: "HOSPITAL" | "LAB" | "CLINIC";
  chain_type: "EVM" | "PERMISSIONED_LEDGER";
  chain_id: string;
  rpc_port: number;
  gateway_public_key: string;
  gateway_private_key?: string;
  gateway_endpoint: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  trust_level: number;
  created_at: number;
}

export interface StaffEntity {
  id: string;
  hospital_wallet: string;
  name: string;
  specialty: string;
  role: "DOCTOR" | "STAFF";
  wallet_address: string;
  private_key?: string;
  is_active: number;
  created_at: number;
}

export interface PatientEntity {
  global_patient_id: string;
  local_pseudonym: string;
  name: string;
  id_secret: string;
  hospital_id: string;
  wallet_address: string;
  encrypted_keystore?: string;
  created_at: number;
}

class DatabaseManager {
  private db: DatabaseSync;
  public readonly storageDir: string;
  private readonly dbPath: string;

  constructor() {
    this.storageDir = path.resolve(
      process.cwd(),
      process.cwd().endsWith("web") ? "../storage" : "storage"
    );

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this.dbPath = path.join(this.storageDir, "medichain.db");
    this.db = new DatabaseSync(this.dbPath);
    this.initTables();
  }

  private initTables(): void {
    // 1. Records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        record_id TEXT PRIMARY KEY,
        patient_pseudonym TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_hash TEXT NOT NULL,
        cipher_hash TEXT NOT NULL,
        issuer_hospital TEXT NOT NULL,
        issuer_doctor TEXT NOT NULL,
        issuer_signature TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        file_name TEXT,
        mime_type TEXT,
        file_size INTEGER,
        version INTEGER DEFAULT 1,
        previous_record_id TEXT,
        created_at INTEGER NOT NULL,
        is_revoked INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_records_patient ON records(patient_pseudonym);
      CREATE INDEX IF NOT EXISTS idx_records_hospital ON records(issuer_hospital);
    `);

    // 2. Wrapped keys table (per recipient)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS record_wrapped_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT NOT NULL,
        recipient_wallet TEXT NOT NULL,
        wrapped_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(record_id, recipient_wallet)
      );
      CREATE INDEX IF NOT EXISTS idx_keys_record ON record_wrapped_keys(record_id);
      CREATE INDEX IF NOT EXISTS idx_keys_recipient ON record_wrapped_keys(recipient_wallet);
    `);

    // 3. Access requests table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS access_requests (
        id TEXT PRIMARY KEY,
        patient_pseudonym TEXT NOT NULL,
        record_id TEXT,
        requesting_hospital TEXT NOT NULL,
        requesting_doctor TEXT NOT NULL,
        reason TEXT NOT NULL,
        scope TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_req_patient ON access_requests(patient_pseudonym);
      CREATE INDEX IF NOT EXISTS idx_req_hospital ON access_requests(requesting_hospital);
    `);

    // 4. Tamper demo backups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tamper_backups (
        record_id TEXT PRIMARY KEY,
        original_data TEXT NOT NULL,
        original_cipher_hash TEXT NOT NULL,
        tampered_at INTEGER NOT NULL
      );
    `);

    // 5. Institutions Directory (Dynamic Onboarding)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS institutions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        institution_type TEXT NOT NULL,
        chain_type TEXT NOT NULL,
        chain_id TEXT NOT NULL,
        rpc_port INTEGER NOT NULL,
        gateway_public_key TEXT NOT NULL,
        gateway_private_key TEXT,
        gateway_endpoint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        trust_level INTEGER DEFAULT 3,
        created_at INTEGER NOT NULL
      );
    `);

    // 6. Hospital Staff & Doctors
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staff_members (
        id TEXT PRIMARY KEY,
        hospital_wallet TEXT NOT NULL,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'DOCTOR',
        wallet_address TEXT NOT NULL,
        private_key TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_staff_hospital ON staff_members(hospital_wallet);
    `);

    // 7. Registered Patients Directory
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registered_patients (
        global_patient_id TEXT PRIMARY KEY,
        local_pseudonym TEXT NOT NULL,
        name TEXT NOT NULL,
        id_secret TEXT NOT NULL,
        hospital_id TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        encrypted_keystore TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_patients_hospital ON registered_patients(hospital_id);
    `);
  }

  // Record methods
  public insertRecord(record: RecordEntity): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO records (
        record_id, patient_pseudonym, record_type, record_hash, cipher_hash,
        issuer_hospital, issuer_doctor, issuer_signature, storage_path,
        file_name, mime_type, file_size, version, previous_record_id, created_at, is_revoked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.record_id,
      record.patient_pseudonym.toLowerCase(),
      record.record_type,
      record.record_hash,
      record.cipher_hash,
      record.issuer_hospital.toLowerCase(),
      record.issuer_doctor.toLowerCase(),
      record.issuer_signature,
      record.storage_path,
      record.file_name || "",
      record.mime_type || "application/json",
      record.file_size || 0,
      record.version || 1,
      record.previous_record_id || null,
      record.created_at || Date.now(),
      record.is_revoked || 0
    );
  }

  public getRecord(recordId: string): RecordEntity | undefined {
    const stmt = this.db.prepare("SELECT * FROM records WHERE record_id = ?");
    return stmt.get(recordId) as RecordEntity | undefined;
  }

  public getRecordByHash(recordHash: string): RecordEntity | undefined {
    const stmt = this.db.prepare("SELECT * FROM records WHERE record_hash = ?");
    return stmt.get(recordHash) as RecordEntity | undefined;
  }

  public getRecordsByPatient(patientPseudonym: string): RecordEntity[] {
    const stmt = this.db.prepare(
      "SELECT * FROM records WHERE patient_pseudonym = ? ORDER BY created_at DESC"
    );
    return stmt.all(patientPseudonym.toLowerCase()) as unknown as RecordEntity[];
  }

  public getRecordsByHospital(hospitalWallet: string): RecordEntity[] {
    const stmt = this.db.prepare(
      "SELECT * FROM records WHERE issuer_hospital = ? ORDER BY created_at DESC"
    );
    return stmt.all(hospitalWallet.toLowerCase()) as unknown as RecordEntity[];
  }

  public getAllRecords(): RecordEntity[] {
    const stmt = this.db.prepare("SELECT * FROM records ORDER BY created_at DESC");
    return stmt.all() as unknown as RecordEntity[];
  }

  public revokeRecord(recordId: string): void {
    const stmt = this.db.prepare("UPDATE records SET is_revoked = 1 WHERE record_id = ?");
    stmt.run(recordId);
  }

  // Wrapped keys methods
  public insertWrappedKey(recordId: string, recipientWallet: string, wrappedKey: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO record_wrapped_keys (record_id, recipient_wallet, wrapped_key, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(recordId, recipientWallet.toLowerCase(), wrappedKey, Date.now());
  }

  public getWrappedKey(recordId: string, recipientWallet: string): string | undefined {
    const stmt = this.db.prepare(
      "SELECT wrapped_key FROM record_wrapped_keys WHERE record_id = ? AND recipient_wallet = ?"
    );
    const row = stmt.get(recordId, recipientWallet.toLowerCase()) as { wrapped_key: string } | undefined;
    return row?.wrapped_key;
  }

  public getWrappedKeysByRecord(recordId: string): WrappedKeyEntity[] {
    const stmt = this.db.prepare(
      "SELECT * FROM record_wrapped_keys WHERE record_id = ?"
    );
    return stmt.all(recordId) as unknown as WrappedKeyEntity[];
  }

  // Access requests methods
  public createAccessRequest(req: Omit<AccessRequestEntity, "status" | "created_at" | "updated_at">): AccessRequestEntity {
    const now = Date.now();
    const entity: AccessRequestEntity = {
      ...req,
      status: "PENDING",
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO access_requests (id, patient_pseudonym, record_id, requesting_hospital, requesting_doctor, reason, scope, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entity.id,
      entity.patient_pseudonym.toLowerCase(),
      entity.record_id || null,
      entity.requesting_hospital.toLowerCase(),
      entity.requesting_doctor.toLowerCase(),
      entity.reason,
      entity.scope,
      entity.status,
      entity.created_at,
      entity.updated_at
    );

    return entity;
  }

  public getAccessRequestsForPatient(patientPseudonym: string): AccessRequestEntity[] {
    const stmt = this.db.prepare(
      "SELECT * FROM access_requests WHERE patient_pseudonym = ? ORDER BY created_at DESC"
    );
    return stmt.all(patientPseudonym.toLowerCase()) as unknown as AccessRequestEntity[];
  }

  public getAccessRequestsForHospital(hospitalWallet: string): AccessRequestEntity[] {
    const stmt = this.db.prepare(
      "SELECT * FROM access_requests WHERE requesting_hospital = ? ORDER BY created_at DESC"
    );
    return stmt.all(hospitalWallet.toLowerCase()) as unknown as AccessRequestEntity[];
  }

  public updateAccessRequestStatus(id: string, status: string): void {
    const stmt = this.db.prepare(
      "UPDATE access_requests SET status = ?, updated_at = ? WHERE id = ?"
    );
    stmt.run(status, Date.now(), id);
  }

  public getAccessRequestById(id: string): AccessRequestEntity | undefined {
    const stmt = this.db.prepare("SELECT * FROM access_requests WHERE id = ?");
    return stmt.get(id) as AccessRequestEntity | undefined;
  }

  public getAllAccessRequests(): AccessRequestEntity[] {
    const stmt = this.db.prepare("SELECT * FROM access_requests ORDER BY created_at DESC");
    return stmt.all() as unknown as AccessRequestEntity[];
  }

  public findExistingTransfer(
    recordId: string,
    requestingHospital: string
  ): AccessRequestEntity | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM access_requests 
      WHERE record_id = ? AND requesting_hospital = ? 
        AND status IN ('PENDING', 'REQUESTED', 'CONSENT_GIVEN', 'RELEASED', 'VERIFIED', 'AVAILABLE')
      LIMIT 1
    `);
    return stmt.get(recordId, requestingHospital.toLowerCase()) as AccessRequestEntity | undefined;
  }

  // Tamper Demo Methods
  public tamperRecordFile(recordId: string): { tampered: boolean; originalHash: string; newHash: string } {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    const fullPath = path.isAbsolute(record.storage_path)
      ? record.storage_path
      : path.join(this.storageDir, path.basename(record.storage_path));

    if (!fs.existsSync(fullPath)) throw new Error(`Storage file ${fullPath} not found`);

    const originalContent = fs.readFileSync(fullPath, "utf-8");

    // Backup original content if not already backed up
    const backupStmt = this.db.prepare(`
      INSERT OR REPLACE INTO tamper_backups (record_id, original_data, original_cipher_hash, tampered_at)
      VALUES (?, ?, ?, ?)
    `);
    backupStmt.run(recordId, originalContent, record.cipher_hash, Date.now());

    // Tamper the file content (flip characters or inject string)
    const tamperedContent = originalContent.slice(0, -6) + "TAMPERED==";
    fs.writeFileSync(fullPath, tamperedContent, "utf-8");

    // Import sha256 to compute new hash
    const nodeCrypto = require("crypto");
    const newHash = "0x" + nodeCrypto.createHash("sha256").update(tamperedContent).digest("hex");

    return {
      tampered: true,
      originalHash: record.cipher_hash,
      newHash,
    };
  }

  public restoreRecordFile(recordId: string): { restored: boolean } {
    const backupStmt = this.db.prepare("SELECT * FROM tamper_backups WHERE record_id = ?");
    const backup = backupStmt.get(recordId) as { original_data: string } | undefined;

    if (!backup) throw new Error(`No tamper backup found for record ${recordId}`);

    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Record ${recordId} not found`);

    const fullPath = path.isAbsolute(record.storage_path)
      ? record.storage_path
      : path.join(this.storageDir, path.basename(record.storage_path));

    fs.writeFileSync(fullPath, backup.original_data, "utf-8");

    // Clean up backup record
    this.db.prepare("DELETE FROM tamper_backups WHERE record_id = ?").run(recordId);

    return { restored: true };
  }

  public isRecordTampered(recordId: string): boolean {
    const stmt = this.db.prepare("SELECT 1 FROM tamper_backups WHERE record_id = ?");
    return !!stmt.get(recordId);
  }

  // Institutions Methods
  public insertInstitution(inst: InstitutionEntity): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO institutions (
        id, name, institution_type, chain_type, chain_id, rpc_port,
        gateway_public_key, gateway_private_key, gateway_endpoint, status, trust_level, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      inst.id,
      inst.name,
      inst.institution_type,
      inst.chain_type,
      inst.chain_id,
      inst.rpc_port,
      inst.gateway_public_key,
      inst.gateway_private_key || null,
      inst.gateway_endpoint,
      inst.status || "ACTIVE",
      inst.trust_level || 3,
      inst.created_at || Date.now()
    );
  }

  public getAllInstitutions(): InstitutionEntity[] {
    const stmt = this.db.prepare("SELECT * FROM institutions ORDER BY created_at ASC");
    return stmt.all() as unknown as InstitutionEntity[];
  }

  public getInstitution(id: string): InstitutionEntity | undefined {
    const stmt = this.db.prepare("SELECT * FROM institutions WHERE id = ?");
    return stmt.get(id) as InstitutionEntity | undefined;
  }

  public updateInstitutionStatus(id: string, status: "ACTIVE" | "SUSPENDED" | "REVOKED"): void {
    const stmt = this.db.prepare("UPDATE institutions SET status = ? WHERE id = ?");
    stmt.run(status, id);
  }

  // Staff & Doctor Methods
  public insertStaff(staff: StaffEntity): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO staff_members (
        id, hospital_wallet, name, specialty, role, wallet_address, private_key, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      staff.id,
      staff.hospital_wallet.toLowerCase(),
      staff.name,
      staff.specialty,
      staff.role,
      staff.wallet_address.toLowerCase(),
      staff.private_key || null,
      staff.is_active ?? 1,
      staff.created_at || Date.now()
    );
  }

  public getStaffByHospital(hospitalWallet: string): StaffEntity[] {
    const stmt = this.db.prepare("SELECT * FROM staff_members WHERE hospital_wallet = ? ORDER BY created_at DESC");
    return stmt.all(hospitalWallet.toLowerCase()) as unknown as StaffEntity[];
  }

  public getAllStaff(): StaffEntity[] {
    const stmt = this.db.prepare("SELECT * FROM staff_members ORDER BY created_at DESC");
    return stmt.all() as unknown as StaffEntity[];
  }

  public getStaffByWallet(wallet: string): StaffEntity | undefined {
    const stmt = this.db.prepare("SELECT * FROM staff_members WHERE wallet_address = ?");
    return stmt.get(wallet.toLowerCase()) as StaffEntity | undefined;
  }

  // Patient Methods
  public insertPatient(patient: PatientEntity): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO registered_patients (
        global_patient_id, local_pseudonym, name, id_secret, hospital_id, wallet_address, encrypted_keystore, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      patient.global_patient_id,
      patient.local_pseudonym,
      patient.name,
      patient.id_secret,
      patient.hospital_id,
      patient.wallet_address.toLowerCase(),
      patient.encrypted_keystore || null,
      patient.created_at || Date.now()
    );
  }

  public getAllPatients(): PatientEntity[] {
    const stmt = this.db.prepare("SELECT * FROM registered_patients ORDER BY created_at DESC");
    return stmt.all() as unknown as PatientEntity[];
  }

  public getPatientByGlobalId(globalId: string): PatientEntity | undefined {
    const stmt = this.db.prepare("SELECT * FROM registered_patients WHERE global_patient_id = ?");
    return stmt.get(globalId) as PatientEntity | undefined;
  }

  public getPatientByWallet(wallet: string): PatientEntity | undefined {
    const stmt = this.db.prepare("SELECT * FROM registered_patients WHERE wallet_address = ?");
    return stmt.get(wallet.toLowerCase()) as PatientEntity | undefined;
  }

  public clearAllData(): void {
    this.db.exec(`
      DELETE FROM records;
      DELETE FROM record_wrapped_keys;
      DELETE FROM access_requests;
      DELETE FROM tamper_backups;
      DELETE FROM institutions;
      DELETE FROM staff_members;
      DELETE FROM registered_patients;
    `);
  }
}

export const dbManager = new DatabaseManager();
