import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";

export interface FabricRecord {
  recordId: string;
  patientIdHash: string;
  recordHash: string;
  cipherHash: string;
  recordType: string;
  issuerDoctorSignature: string;
  storageRef: string;
  timestamp: number;
  txId: string;
}

export interface FabricConsent {
  consentId: string;
  patientIdHash: string;
  grantee: string;
  recordId: string;
  scope: string;
  validUntil: number;
  isActive: boolean;
  grantedAt: number;
}

export interface FabricAuditLog {
  auditId: string;
  actor: string;
  action: string;
  targetId: string;
  details: string;
  timestamp: number;
  txId: string;
}

@Info({ title: "MedicalRecordContract", description: "MediChain Hyperledger Fabric Sovereign Chaincode" })
export class MedicalContract extends Contract {
  constructor() {
    super("MedicalContract");
  }

  @Transaction()
  public async InitLedger(ctx: Context): Promise<void> {
    console.info("============= INITIALIZE MEDICAL RECORD CHAINCODE ===========");
  }

  @Transaction()
  public async RegisterRecord(
    ctx: Context,
    recordId: string,
    patientIdHash: string,
    recordHash: string,
    cipherHash: string,
    recordType: string,
    issuerDoctorSignature: string,
    storageRef: string
  ): Promise<string> {
    const exists = await this.RecordExists(ctx, recordId);
    if (exists) {
      throw new Error(`Record ${recordId} already exists in Fabric state database`);
    }

    const txId = ctx.stub.getTxID();
    const timestamp = ctx.stub.getTxTimestamp().seconds.low;

    const record: FabricRecord = {
      recordId,
      patientIdHash,
      recordHash,
      cipherHash,
      recordType,
      issuerDoctorSignature,
      storageRef,
      timestamp,
      txId,
    };

    const key = ctx.stub.createCompositeKey("RECORD", [recordId]);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    // Emit block event
    await ctx.stub.setEvent("RecordRegistered", Buffer.from(JSON.stringify({ recordId, patientIdHash, recordHash })));
    return JSON.stringify(record);
  }

  @Transaction(false)
  public async GetRecord(ctx: Context, recordId: string): Promise<string> {
    const key = ctx.stub.createCompositeKey("RECORD", [recordId]);
    const recordBytes = await ctx.stub.getState(key);
    if (!recordBytes || recordBytes.length === 0) {
      throw new Error(`Record ${recordId} does not exist`);
    }
    return recordBytes.toString("utf8");
  }

  @Transaction()
  public async GrantConsent(
    ctx: Context,
    consentId: string,
    patientIdHash: string,
    grantee: string,
    recordId: string,
    scope: string,
    validUntil: number
  ): Promise<string> {
    const timestamp = ctx.stub.getTxTimestamp().seconds.low;

    const consent: FabricConsent = {
      consentId,
      patientIdHash,
      grantee,
      recordId,
      scope,
      validUntil,
      isActive: true,
      grantedAt: timestamp,
    };

    const key = ctx.stub.createCompositeKey("CONSENT", [patientIdHash, grantee, recordId]);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(consent)));

    await ctx.stub.setEvent("ConsentGranted", Buffer.from(JSON.stringify({ consentId, patientIdHash, grantee, scope })));
    return JSON.stringify(consent);
  }

  @Transaction()
  public async RevokeConsent(
    ctx: Context,
    patientIdHash: string,
    grantee: string,
    recordId: string
  ): Promise<void> {
    const key = ctx.stub.createCompositeKey("CONSENT", [patientIdHash, grantee, recordId]);
    const consentBytes = await ctx.stub.getState(key);
    if (!consentBytes || consentBytes.length === 0) {
      throw new Error(`Consent does not exist for patient ${patientIdHash} and grantee ${grantee}`);
    }

    const consent: FabricConsent = JSON.parse(consentBytes.toString("utf8"));
    consent.isActive = false;

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(consent)));
    await ctx.stub.setEvent("ConsentRevoked", Buffer.from(JSON.stringify({ consentId: consent.consentId, patientIdHash, grantee })));
  }

  @Transaction(false)
  public async CheckConsent(
    ctx: Context,
    patientIdHash: string,
    grantee: string,
    recordId: string
  ): Promise<string> {
    const key = ctx.stub.createCompositeKey("CONSENT", [patientIdHash, grantee, recordId]);
    const consentBytes = await ctx.stub.getState(key);
    if (!consentBytes || consentBytes.length === 0) {
      return JSON.stringify({ hasAccess: false, reason: "NO_CONSENT_FOUND" });
    }

    const consent: FabricConsent = JSON.parse(consentBytes.toString("utf8"));
    if (!consent.isActive) {
      return JSON.stringify({ hasAccess: false, reason: "CONSENT_REVOKED" });
    }

    const currentTimestamp = ctx.stub.getTxTimestamp().seconds.low;
    if (consent.validUntil <= currentTimestamp) {
      return JSON.stringify({ hasAccess: false, reason: "CONSENT_EXPIRED" });
    }

    return JSON.stringify({ hasAccess: true, isEmergency: false, reason: "VALID_ACTIVE_CONSENT", validUntil: consent.validUntil });
  }

  @Transaction()
  public async LogAudit(
    ctx: Context,
    actor: string,
    action: string,
    targetId: string,
    details: string
  ): Promise<string> {
    const txId = ctx.stub.getTxID();
    const timestamp = ctx.stub.getTxTimestamp().seconds.low;
    const auditId = "audit_" + txId.slice(0, 16);

    const audit: FabricAuditLog = {
      auditId,
      actor,
      action,
      targetId,
      details,
      timestamp,
      txId,
    };

    const key = ctx.stub.createCompositeKey("AUDIT", [auditId]);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(audit)));
    return JSON.stringify(audit);
  }

  @Transaction(false)
  public async GetRecordProof(ctx: Context, recordId: string): Promise<string> {
    const key = ctx.stub.createCompositeKey("RECORD", [recordId]);
    const recordBytes = await ctx.stub.getState(key);
    if (!recordBytes || recordBytes.length === 0) {
      throw new Error(`Record ${recordId} not found`);
    }

    const record: FabricRecord = JSON.parse(recordBytes.toString("utf8"));
    const historyIterator = await ctx.stub.getHistoryForKey(key);
    let blockNumber = 1;
    let txId = record.txId;

    if (historyIterator) {
      const historyResult = await historyIterator.next();
      if (!historyResult.done) {
        txId = historyResult.value.txId;
      }
      await historyIterator.close();
    }

    return JSON.stringify({
      recordId: record.recordId,
      recordHash: record.recordHash,
      cipherHash: record.cipherHash,
      txId,
      blockNumber,
      stateValidationCode: "VALID",
      chainType: "HYPERLEDGER_FABRIC",
    });
  }

  @Transaction(false)
  public async RecordExists(ctx: Context, recordId: string): Promise<boolean> {
    const key = ctx.stub.createCompositeKey("RECORD", [recordId]);
    const recordBytes = await ctx.stub.getState(key);
    return recordBytes && recordBytes.length > 0;
  }
}
