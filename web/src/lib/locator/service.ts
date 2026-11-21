export interface LocatorEntry {
  institutionId: string;
  institutionName: string;
  chainIdentifier: string;
  chainType: string;
  recordType: string;
  recordCount: number;
  lastUpdatedAt: number;
}

const locatorStorage: Map<string, LocatorEntry[]> = new Map();
const patientOptOuts: Set<string> = new Set();

export function getPatientRecordLocations(globalPatientId: string): LocatorEntry[] {
  const key = globalPatientId.toLowerCase();
  if (patientOptOuts.has(key)) {
    throw new Error("Patient has chosen to hide their record locator index from federated search");
  }
  return locatorStorage.get(key) || [];
}

export function setPatientLocatorVisibility(globalPatientId: string, isVisible: boolean): void {
  const key = globalPatientId.toLowerCase();
  if (isVisible) {
    patientOptOuts.delete(key);
  } else {
    patientOptOuts.add(key);
  }
}

export function isPatientLocatorHidden(globalPatientId: string): boolean {
  return patientOptOuts.has(globalPatientId.toLowerCase());
}

export function upsertRecordLocator(
  globalPatientId: string,
  institutionId: string,
  institutionName: string,
  chainIdentifier: string,
  chainType: string,
  recordType: string,
  count: number
): void {
  const key = globalPatientId.toLowerCase();
  const current = locatorStorage.get(key) || [];
  const idx = current.findIndex(
    (e) => e.institutionId.toLowerCase() === institutionId.toLowerCase() && e.recordType === recordType
  );

  const now = Math.floor(Date.now() / 1000);
  if (idx >= 0) {
    current[idx].recordCount = count;
    current[idx].lastUpdatedAt = now;
  } else {
    current.push({
      institutionId,
      institutionName,
      chainIdentifier,
      chainType,
      recordType,
      recordCount: count,
      lastUpdatedAt: now,
    });
  }
  locatorStorage.set(key, current);
}

export function clearLocatorStorage(): void {
  locatorStorage.clear();
  patientOptOuts.clear();
}
