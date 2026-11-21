import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FhirClinicalDocument, ClinicalCategory } from "../interop/types/fhir";
import { deriveGlobalPatientId, deriveLocalPatientPseudonym } from "../interop/types/identity";

export interface SyntheticPatient {
  idSecret: string;
  globalPatientId: string;
  name: string;
  gender: "male" | "female" | "other";
  birthDate: string;
  city: string;
}

export const SYNTHETIC_PATIENTS: SyntheticPatient[] = [
  {
    idSecret: "SYNTHETIC-NATIONAL-ID-001-ALICE",
    globalPatientId: deriveGlobalPatientId("SYNTHETIC-NATIONAL-ID-001-ALICE"),
    name: "Alice M. Carter (Synthetic)",
    gender: "female",
    birthDate: "1985-04-12",
    city: "Metropolis",
  },
  {
    idSecret: "SYNTHETIC-NATIONAL-ID-002-BOB",
    globalPatientId: deriveGlobalPatientId("SYNTHETIC-NATIONAL-ID-002-BOB"),
    name: "Robert J. Miller (Synthetic)",
    gender: "male",
    birthDate: "1972-11-23",
    city: "Gotham",
  },
  {
    idSecret: "SYNTHETIC-NATIONAL-ID-003-CHARLIE",
    globalPatientId: deriveGlobalPatientId("SYNTHETIC-NATIONAL-ID-003-CHARLIE"),
    name: "Charlie D. Evans (Synthetic)",
    gender: "other",
    birthDate: "1994-08-30",
    city: "Star City",
  },
];

export function createSyntheticFhirDocument(
  category: ClinicalCategory,
  patient: SyntheticPatient,
  institution: { id: string; name: string; chainId: string; doctorName: string; doctorWallet: string }
): FhirClinicalDocument {
  const docId = `rec_synth_${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const pseudonym = deriveLocalPatientPseudonym(patient.globalPatientId, institution.id);

  switch (category) {
    case "CARDIOLOGY":
      return {
        resourceType: "DiagnosticReport",
        id: docId,
        status: "final",
        category: "CARDIOLOGY",
        code: {
          system: "http://loinc.org",
          code: "11524-6",
          display: "12-Lead Electrocardiogram & Echocardiography Study",
        },
        subject: {
          globalPatientId: patient.globalPatientId,
          pseudonym,
          displayName: patient.name,
        },
        effectiveDateTime: now,
        issued: now,
        performer: {
          institutionId: institution.id,
          institutionName: institution.name,
          chainIdentifier: institution.chainId,
          practitionerName: institution.doctorName,
          practitionerWallet: institution.doctorWallet,
        },
        conclusion: "Normal sinus rhythm at 72 bpm. Left ventricular ejection fraction 62%. No acute ischemic ST changes.",
        criticalAlert: false,
        notes: [
          "Blood Pressure: 122/78 mmHg",
          "PR Interval: 156 ms",
          "QRS Duration: 88 ms",
          "QTc Interval: 412 ms",
        ],
      };

    case "HEMATOLOGY":
      return {
        resourceType: "DiagnosticReport",
        id: docId,
        status: "final",
        category: "HEMATOLOGY",
        code: {
          system: "http://loinc.org",
          code: "58410-2",
          display: "Complete Blood Count with Automated Differential",
        },
        subject: {
          globalPatientId: patient.globalPatientId,
          pseudonym,
          displayName: patient.name,
        },
        effectiveDateTime: now,
        issued: now,
        performer: {
          institutionId: institution.id,
          institutionName: institution.name,
          chainIdentifier: institution.chainId,
          practitionerName: institution.doctorName,
          practitionerWallet: institution.doctorWallet,
        },
        conclusion: "Hematocrit and hemoglobin within normal physiological limits. Normal platelet count. No cytopenia.",
        criticalAlert: false,
        notes: [
          "WBC: 6.8 x10^3/uL (Ref: 4.5-11.0)",
          "RBC: 4.75 x10^6/uL (Ref: 4.2-5.4)",
          "Hemoglobin: 14.2 g/dL (Ref: 12.0-16.0)",
          "Platelets: 245 x10^3/uL (Ref: 150-450)",
        ],
      };

    case "RADIOLOGY":
      return {
        resourceType: "DiagnosticReport",
        id: docId,
        status: "final",
        category: "RADIOLOGY",
        code: {
          system: "http://loinc.org",
          code: "18748-4",
          display: "High-Resolution Diagnostic Chest CT & Thoracic Imaging",
        },
        subject: {
          globalPatientId: patient.globalPatientId,
          pseudonym,
          displayName: patient.name,
        },
        effectiveDateTime: now,
        issued: now,
        performer: {
          institutionId: institution.id,
          institutionName: institution.name,
          chainIdentifier: institution.chainId,
          practitionerName: institution.doctorName,
          practitionerWallet: institution.doctorWallet,
        },
        conclusion: "Lungs are clear bilaterally. No pulmonary consolidation, pleural effusion, or pneumothorax.",
        criticalAlert: false,
        notes: [
          "Scout and axial helical CT images obtained at 1.25mm slice thickness without IV contrast.",
          "Mediastinal contours are normal.",
        ],
      };

    case "EMERGENCY_TRIAGE":
    default:
      return {
        resourceType: "CarePlan",
        id: docId,
        status: "final",
        category: "EMERGENCY_TRIAGE",
        code: {
          system: "http://loinc.org",
          code: "54094-8",
          display: "Emergency Department Critical Summary & Resuscitation Triage",
        },
        subject: {
          globalPatientId: patient.globalPatientId,
          pseudonym,
          displayName: patient.name,
        },
        effectiveDateTime: now,
        issued: now,
        performer: {
          institutionId: institution.id,
          institutionName: institution.name,
          chainIdentifier: institution.chainId,
          practitionerName: institution.doctorName,
          practitionerWallet: institution.doctorWallet,
        },
        conclusion: "Emergency triage category 2 (Emergent). Acute allergic response managed with epinephrine and antihistamines.",
        criticalAlert: true,
        notes: [
          "Allergies: Severe Penicillin Allergy (Anaphylaxis risk)",
          "Heart Rate: 104 bpm",
          "Oxygen Saturation: 98% on room air",
          "Emergency Contact: Notified via federation dispatch",
        ],
      };
  }
}

/**
 * CLI execution for generating synthetic test data bundles.
 */
function main() {
  const outputDir = path.join(process.cwd(), "test-records", "synthetic");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sampleInst = {
    id: "hospital-sepolia-01",
    name: "City General Hospital",
    chainId: "11155111",
    doctorName: "Dr. Evelyn Reed, MD",
    doctorWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  };

  const categories: ClinicalCategory[] = ["CARDIOLOGY", "HEMATOLOGY", "RADIOLOGY", "EMERGENCY_TRIAGE"];
  const generatedFiles: string[] = [];

  for (const patient of SYNTHETIC_PATIENTS) {
    for (const cat of categories) {
      const doc = createSyntheticFhirDocument(cat, patient, sampleInst);
      const fileName = `${patient.name.split(" ")[0].toLowerCase()}_${cat.toLowerCase()}_${doc.id}.json`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), "utf-8");
      generatedFiles.push(fileName);
    }
  }

  console.log(`\n======================================================`);
  console.log(` Synthetic Clinical Data Generator (Zero PII / Synthea) `);
  console.log(`======================================================`);
  console.log(`Generated ${generatedFiles.length} synthetic FHIR documents in:`);
  console.log(`-> ${outputDir}`);
  for (const file of generatedFiles) {
    console.log(`   * ${file}`);
  }
  console.log(`\nThese files can be freely uploaded into MediChain up to 25 MB.`);
  console.log(`======================================================\n`);
}

if (require.main === module) {
  main();
}
