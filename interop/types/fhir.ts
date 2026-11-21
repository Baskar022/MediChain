/**
 * FHIR-Inspired Canonical Clinical Schema
 * Standardizes medical record payloads across autonomous hospitals, clinics, and diagnostic labs
 * based on HL7 FHIR (Fast Healthcare Interoperability Resources) R4 concepts.
 */

export type FhirResourceType =
  | "DiagnosticReport"
  | "Observation"
  | "DocumentReference"
  | "CarePlan"
  | "Condition"
  | "MedicationStatement";

export type ClinicalCategory =
  | "CARDIOLOGY"
  | "RADIOLOGY"
  | "HEMATOLOGY"
  | "PATHOLOGY"
  | "EMERGENCY_TRIAGE"
  | "GENERAL_CONSULTATION"
  | "VITAL_SIGNS";

export interface FhirCoding {
  system: string; // e.g. "http://loinc.org" or "http://snomed.info/sct"
  code: string;
  display: string;
}

export interface FhirClinicalAttachment {
  contentType: string; // e.g. "application/pdf", "image/png", "application/json"
  title: string;
  sizeBytes?: number;
  dataBase64?: string;
  url?: string;
}

export interface FhirClinicalDocument {
  resourceType: FhirResourceType;
  id: string;
  status: "preliminary" | "final" | "amended" | "corrected" | "cancelled";
  category: ClinicalCategory;
  code: FhirCoding;
  subject: {
    globalPatientId: string;
    pseudonym: string;
    displayName?: string;
  };
  effectiveDateTime: string;
  issued: string;
  performer: {
    institutionId: string;
    institutionName: string;
    chainIdentifier: string;
    practitionerName: string;
    practitionerWallet: string;
  };
  conclusion?: string;
  criticalAlert?: boolean;
  notes?: string[];
  presentedForm?: FhirClinicalAttachment[];
  rawPayload?: Record<string, any>;
}

/**
 * Validates a FHIR-inspired clinical document.
 */
export function validateFhirClinicalDocument(doc: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!doc) {
    return { valid: false, errors: ["Document payload is null or undefined"] };
  }
  if (!doc.resourceType) errors.push("Missing 'resourceType'");
  if (!doc.id) errors.push("Missing document 'id'");
  if (!doc.category) errors.push("Missing clinical 'category'");
  if (!doc.subject || !doc.subject.globalPatientId) errors.push("Missing 'subject.globalPatientId'");
  if (!doc.performer || !doc.performer.institutionId) errors.push("Missing 'performer.institutionId'");
  if (!doc.effectiveDateTime && !doc.issued) errors.push("Missing record timestamp ('effectiveDateTime' or 'issued')");

  return {
    valid: errors.length === 0,
    errors,
  };
}
