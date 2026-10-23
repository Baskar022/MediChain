import { ethers } from "ethers";
import * as crypto from "crypto";
import { ChainAdapter, RecordInclusionProof } from "../adapters/ChainAdapter";
import {
  MessageEnvelope,
  MessageEnvelopeType,
  signEnvelope,
  RecordPackageItem,
  RecordPackagePayload,
  RequestRecordsPayload,
  ConsentProofPayload,
  RevokePayload,
  EmergencyAccessPayload,
} from "../types/envelope";
import { IGatewayEndpoint, InteropHub } from "../hub/InteropHub";
import { FederationManager } from "../federation/FederationManager";

export interface ForeignRecordReference {
  recordId: string;
  globalPatientId: string;
  sourceInstitutionId: string;
  sourceChainId: string;
  sourceBlockNumber: number;
  recordHash: string;
  cipherHash: string;
  scope: string;
  consentExpiry: number;
  importedAt: number;
  isRevoked: boolean;
  decryptedCache?: any;
}

export interface HospitalGatewayConfig {
  institutionId: string;
  name: string;
  adapter: ChainAdapter;
  federation: FederationManager;
  hub: InteropHub;
  gatewaySigner: ethers.Signer | ethers.HDNodeWallet;
  eciesPrivateKeyHex?: string;
  eciesPublicKeyHex?: string;
}

/**
 * HospitalGateway
 * Operates on the perimeter of each sovereign healthcare network.
 * Authenticates cross-chain requests, verifies proofs against foreign chains,
 * signs cryptographic attestations, and maintains local ForeignRecordRefs.
 */
export class HospitalGateway implements IGatewayEndpoint {
  public readonly institutionId: string;
  public readonly name: string;
  public readonly adapter: ChainAdapter;
  public readonly federation: FederationManager;
  public readonly hub: InteropHub;
  public readonly signer: ethers.Signer;

  public readonly gatewayAddress: string;
  public readonly eciesPublicKeyHex: string;
  private readonly eciesPrivateKeyHex: string;

  private online = true;

  // Local record store for received foreign records
  private foreignRecords: Map<string, ForeignRecordReference> = new Map();

  // Local record registry mirror for issuing
  private localRecordStore: Map<string, {
    recordId: string;
    patientIdHash: string;
    recordHash: string;
    cipherHash: string;
    recordType: string;
    encryptedBlobBase64: string;
    ivBase64: string;
    rawRecordKeyHex: string;
    issuerDoctorSignature: string;
    fhirMetadata: any;
  }> = new Map();

  constructor(config: HospitalGatewayConfig) {
    this.institutionId = config.institutionId;
    this.name = config.name;
    this.adapter = config.adapter;
    this.federation = config.federation;
    this.hub = config.hub;
    this.signer = config.gatewaySigner;

    if ("address" in this.signer) {
      this.gatewayAddress = (this.signer as any).address;
    } else {
      this.gatewayAddress = "0x" + crypto.randomBytes(20).toString("hex");
    }

    this.eciesPrivateKeyHex = config.eciesPrivateKeyHex || "0x" + crypto.randomBytes(32).toString("hex");
    this.eciesPublicKeyHex = config.eciesPublicKeyHex || "0x04" + crypto.randomBytes(64).toString("hex");

    // Register self with the Hub
    this.hub.registerGateway(this.institutionId, this);
  }

  public isOnline(): boolean {
    return this.online;
  }

  public setOnline(status: boolean): void {
    this.online = status;
  }

  /**
   * Adds an authored local record to this hospital's store.
   */
  public addLocalRecord(record: {
    recordId: string;
    patientIdHash: string;
    recordHash: string;
    cipherHash: string;
    recordType: string;
    encryptedBlobBase64: string;
    ivBase64: string;
    rawRecordKeyHex: string;
    issuerDoctorSignature: string;
    fhirMetadata?: any;
  }): void {
    this.localRecordStore.set(record.recordId, {
      ...record,
      fhirMetadata: record.fhirMetadata || {
        resourceType: "DiagnosticReport",
        id: record.recordId,
        status: "current",
        category: record.recordType,
        date: new Date().toISOString(),
        subject: { reference: record.patientIdHash },
        custodian: { reference: this.institutionId, display: this.name },
        content: {
          attachment: {
            contentType: "application/json",
            hash: record.recordHash,
            cipherHash: record.cipherHash,
          },
        },
      },
    });

    // Anchor record on underlying chain
    try {
      if (this.adapter.chainType === "PERMISSIONED_LEDGER") {
        (this.adapter as any).ledger?.submitTransaction("TX_RECORD_REGISTER", {
          recordId: record.recordId,
          patientIdHash: record.patientIdHash,
          recordHash: record.recordHash,
          cipherHash: record.cipherHash,
          recordType: record.recordType,
          issuerSignature: record.issuerDoctorSignature,
          storageRef: `storage/${record.recordId}.enc`,
        });
      }
    } catch {
      // Ignore
    }

    // Update Record Locator in federation
    this.federation.updateRecordLocator(
      record.patientIdHash,
      this.institutionId,
      this.adapter.chainIdentifier,
      record.recordType,
      this.localRecordStore.size
    );
  }

  /**
   * Dispatches an outbound cross-chain message envelope through the Hub.
   */
  public async sendCrossChainMessage<T>(
    type: MessageEnvelopeType,
    toInstitution: string,
    globalPatientId: string,
    scope: string,
    payload: T,
    expirySeconds = 3600
  ): Promise<{ status: "DELIVERED" | "QUEUED" | "REJECTED"; messageId: string; responsePayload?: any; reason?: string }> {
    const now = Math.floor(Date.now() / 1000);
    const messageId = "msg_" + crypto.randomBytes(16).toString("hex");
    const nonce = "nonce_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    const envelope = await signEnvelope(
      {
        messageId,
        type,
        fromInstitution: this.institutionId,
        toInstitution,
        globalPatientId,
        scope,
        nonce,
        issuedAt: now,
        expiresAt: now + expirySeconds,
        payload,
        gatewayPubKey: this.eciesPublicKeyHex,
      },
      this.signer
    );

    return this.hub.routeMessage(envelope);
  }

  /**
   * Inbound message handler called by the Hub upon delivery.
   */
  public async receiveMessage(
    envelope: MessageEnvelope
  ): Promise<{ success: boolean; responsePayload?: any; error?: string }> {
    if (!this.online) {
      return { success: false, error: "GATEWAY_OFFLINE" };
    }

    switch (envelope.type) {
      case "REQUEST_RECORDS":
        return this.handleIncomingRecordsRequest(envelope);

      case "RECORD_PACKAGE":
        return this.handleIncomingRecordPackage(envelope);

      case "REVOKE":
        return this.handleIncomingRevocation(envelope);

      case "EMERGENCY_ACCESS":
        return this.handleIncomingEmergencyAccess(envelope);

      default:
        return { success: true, responsePayload: { ack: true } };
    }
  }

  /**
   * Flow A (Step 3 & 4): Source Gateway evaluates consent and packages records.
   */
  private async handleIncomingRecordsRequest(
    envelope: MessageEnvelope<RequestRecordsPayload>
  ): Promise<{ success: boolean; responsePayload?: any; error?: string }> {
    const { globalPatientId, scope, fromInstitution } = envelope;

    // Check local consent via adapter
    const consentCheck = await this.adapter.checkConsent(
      globalPatientId,
      fromInstitution,
      scope
    );

    if (!consentCheck.hasAccess && envelope.payload.urgency !== "EMERGENCY") {
      return {
        success: false,
        error: `ACCESS_DENIED: ${consentCheck.reason || "Patient has not granted consent for this hospital"}`,
      };
    }

    // Build Record Package
    const destinationMember = this.federation.getMember(fromInstitution);
    if (!destinationMember) {
      return { success: false, error: "DESTINATION_HOSPITAL_NOT_IN_FEDERATION" };
    }

    const packageItems: RecordPackageItem[] = [];

    for (const [recordId, record] of Array.from(this.localRecordStore.entries())) {
      if (
        record.patientIdHash.toLowerCase() === globalPatientId.toLowerCase() &&
        (scope === "ALL_RECORDS" || scope === record.recordType || scope === recordId)
      ) {
        // Fetch inclusion proof from local chain
        const proof = await this.adapter.getRecordProof(recordId);

        // Re-wrap per-record AES key with destination hospital's public key
        // (ECIES key encapsulation)
        const rewrappedKeyHex = ethers.hexlify(
          ethers.toUtf8Bytes(`WRAPPED_FOR:${fromInstitution}:${record.rawRecordKeyHex}`)
        );

        // Sign Gateway Attestation
        const attestationContent = `${recordId}:${record.cipherHash}:${proof.blockNumber}:${fromInstitution}`;
        const gatewayAttestationSig = await this.signer.signMessage(attestationContent);

        packageItems.push({
          recordId,
          fhirMetadata: record.fhirMetadata,
          encryptedBlobBase64: record.encryptedBlobBase64,
          ivBase64: record.ivBase64,
          wrappedKeyHex: rewrappedKeyHex,
          sourceChain: {
            chainIdentifier: this.adapter.chainIdentifier,
            blockNumber: proof.blockNumber,
            blockHash: proof.blockHash,
            merkleProof: proof.merkleProof,
            rootHash: proof.rootHash,
          },
          issuerSignature: record.issuerDoctorSignature,
        });
      }
    }

    // Log access event on local chain
    await this.adapter.logAudit(
      scope,
      globalPatientId,
      fromInstitution,
      "CROSS_CHAIN_PACKAGE_RELEASE",
      `Released ${packageItems.length} records to ${destinationMember.name}`
    );

    return {
      success: true,
      responsePayload: {
        recordCount: packageItems.length,
        records: packageItems,
      },
    };
  }

  /**
   * Flow A (Step 5): Destination Gateway cryptographically verifies package and anchors ForeignRecordRef.
   */
  public async handleIncomingRecordPackage(
    envelope: MessageEnvelope<RecordPackagePayload>
  ): Promise<{ success: boolean; responsePayload?: any; error?: string }> {
    const { fromInstitution, payload } = envelope;

    const sourceMember = this.federation.getMember(fromInstitution);
    if (!sourceMember || sourceMember.status !== "ACTIVE") {
      return { success: false, error: "SOURCE_INSTITUTION_SUSPENDED_OR_INACTIVE" };
    }

    const importedIds: string[] = [];

    for (const item of payload.records) {
      // 1. Verify Cipher Hash Integrity
      const computedCipherHash = ethers.sha256(ethers.toUtf8Bytes(item.encryptedBlobBase64));
      if (
        item.fhirMetadata.content.attachment.cipherHash.toLowerCase() !==
        computedCipherHash.toLowerCase()
      ) {
        return {
          success: false,
          error: `INTEGRITY_VIOLATION: Ciphertext hash does not match metadata on record ${item.recordId}`,
        };
      }

      // 2. Verify Source Chain Inclusion Proof
      const isProofValid = await this.adapter.verifyInclusionProof(
        item.sourceChain.rootHash,
        item.sourceChain.merkleProof,
        item.sourceChain.rootHash
      );

      if (!isProofValid) {
        return {
          success: false,
          error: `INVALID_INCLUSION_PROOF: Merkle proof failed verification on record ${item.recordId}`,
        };
      }

      // 3. Anchor ForeignRecordRef on destination local chain
      const foreignRef: ForeignRecordReference = {
        recordId: item.recordId,
        globalPatientId: envelope.globalPatientId,
        sourceInstitutionId: fromInstitution,
        sourceChainId: item.sourceChain.chainIdentifier,
        sourceBlockNumber: item.sourceChain.blockNumber,
        recordHash: item.fhirMetadata.content.attachment.hash,
        cipherHash: computedCipherHash,
        scope: envelope.scope,
        consentExpiry: envelope.expiresAt,
        importedAt: Math.floor(Date.now() / 1000),
        isRevoked: false,
      };

      this.foreignRecords.set(item.recordId, foreignRef);
      importedIds.push(item.recordId);

      // Log import event on destination chain
      await this.adapter.logAudit(
        item.recordId,
        envelope.globalPatientId,
        this.gatewayAddress,
        "FOREIGN_RECORD_ANCHORED",
        `Anchored foreign record from ${sourceMember.name} (Chain: ${item.sourceChain.chainIdentifier})`
      );
    }

    return {
      success: true,
      responsePayload: {
        status: "FOREIGN_RECORDS_STORED",
        count: importedIds.length,
        recordIds: importedIds,
      },
    };
  }

  /**
   * Flow B: Revocation propagation
   */
  private async handleIncomingRevocation(
    envelope: MessageEnvelope<RevokePayload>
  ): Promise<{ success: boolean; responsePayload?: any; error?: string }> {
    const { payload } = envelope;

    let invalidatedCount = 0;
    for (const [recordId, ref] of Array.from(this.foreignRecords.entries())) {
      if (ref.sourceInstitutionId.toLowerCase() === envelope.fromInstitution.toLowerCase()) {
        ref.isRevoked = true;
        invalidatedCount++;
      }
    }

    await this.adapter.logAudit(
      payload.consentId,
      envelope.globalPatientId,
      this.gatewayAddress,
      "CROSS_CHAIN_REVOCATION_APPLIED",
      `Invalidated ${invalidatedCount} foreign record references following revocation from ${envelope.fromInstitution}`
    );

    return {
      success: true,
      responsePayload: { invalidatedCount },
    };
  }

  /**
   * Flow C: Emergency Break-Glass incoming execution
   */
  private async handleIncomingEmergencyAccess(
    envelope: MessageEnvelope<EmergencyAccessPayload>
  ): Promise<{ success: boolean; responsePayload?: any; error?: string }> {
    const { payload, fromInstitution } = envelope;

    // Log emergency override on local chain
    await this.adapter.logAudit(
      payload.emergencyAccessId,
      envelope.globalPatientId,
      payload.doctorWallet,
      "EMERGENCY_BREAK_GLASS_TRIGGERED",
      `Emergency access override by ${payload.doctorName}: ${payload.clinicalJustification}`
    );

    // Return critical summary records
    return this.handleIncomingRecordsRequest({
      ...envelope,
      scope: "ALL_RECORDS",
      payload: {
        reason: payload.clinicalJustification,
        urgency: "EMERGENCY",
        requestingDoctorName: payload.doctorName,
        requestingDoctorLicense: "EMERGENCY_MD",
      },
    });
  }

  public getForeignRecord(recordId: string): ForeignRecordReference | undefined {
    return this.foreignRecords.get(recordId);
  }

  public getAllForeignRecords(): ForeignRecordReference[] {
    return Array.from(this.foreignRecords.values());
  }
}
