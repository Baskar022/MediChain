import { test, expect } from "@playwright/test";

test.describe.serial("MediChain Production Hardening & Cross-Chain E2E Suite", () => {
  const timestamp = Date.now();
  const hospitalA = {
    name: `Mount Sinai General ${timestamp}`,
    type: "HOSPITAL",
    chainType: "EVM",
    chainId: "31337",
    rpcPort: 8545,
    gatewayEndpoint: "http://localhost:8545",
  };
  const hospitalB = {
    name: `Genesis Genomics Lab ${timestamp}`,
    type: "LAB",
    chainType: "PERMISSIONED_LEDGER",
    chainId: "custom-fabric-sim",
    rpcPort: 9000,
    gatewayEndpoint: "http://localhost:9000",
  };
  const doctor = {
    name: `Dr. Gregory House ${timestamp}`,
    specialty: "Diagnostic Medicine & Immunology",
    walletAddress: `0x${timestamp.toString(16).padStart(40, "0")}`,
    role: "DOCTOR",
  };
  const patient = {
    name: `Evelyn Thorne ${timestamp}`,
    idSecret: `SEC_PASSPORT_${timestamp}`,
  };
  let createdRecordId = "";

  test("1. Clean Start & Health Status Check", async ({ page }) => {
    // Check Status Endpoint
    const res = await page.request.get("/api/explorer");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.networks).toBeDefined();

    // Check Multi-Chain Explorer Page
    await page.goto("/explorer");
    await expect(page.locator("h1")).toContainText("Multi-Chain Sovereign Explorer");
    await expect(page.getByText("City General Hospital").first()).toBeVisible();
    await expect(page.getByText("Metro Diagnostics Lab").first()).toBeVisible();
  });

  test("2. Dynamic Onboarding of 2 Heterogeneous Institutions", async ({ page }) => {
    // 1. Onboard Hospital A (EVM) via API
    const resA = await page.request.post("/api/federation/institutions", {
      data: hospitalA,
    });
    expect(resA.ok()).toBeTruthy();
    const dataA = await resA.json();
    expect(dataA.institution.name).toBe(hospitalA.name);
    expect(dataA.institution.chain_type).toBe("EVM");

    // 2. Onboard Hospital B (Non-EVM Permissioned Ledger / Simulated Fabric) via API
    const resB = await page.request.post("/api/federation/institutions", {
      data: hospitalB,
    });
    expect(resB.ok()).toBeTruthy();
    const dataB = await resB.json();
    expect(dataB.institution.name).toBe(hospitalB.name);
    expect(dataB.institution.chain_type).toBe("PERMISSIONED_LEDGER");

    // 3. Verify in Federation Registry UI
    await page.goto("/admin/federation");
    await expect(page.locator("h1").first()).toContainText("Federation Registry & Interop Portal");
    await expect(page.getByText(hospitalA.name).first()).toBeVisible();
    await expect(page.getByText(hospitalB.name).first()).toBeVisible();
  });

  test("3. Provisioning Hospital Doctor", async ({ page }) => {
    // Register medical staff member
    const res = await page.request.post("/api/hospitals/doctors", {
      data: {
        hospitalWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        name: doctor.name,
        specialty: doctor.specialty,
        walletAddress: doctor.walletAddress,
        role: "DOCTOR",
      },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.staff.name).toBe(doctor.name);

    // Verify staff list endpoint
    const listRes = await page.request.get("/api/hospitals/doctors");
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    const found = listData.staff.find((s: any) => s.name === doctor.name);
    expect(found).toBeDefined();
  });

  test("4. Patient Registration & In-Browser Keystore Generation", async ({ page }) => {
    await page.goto("/patient/register");
    await expect(page.locator("h1").first()).toContainText("Register New Patient Identity");

    await page.getByPlaceholder("e.g. John Doe, Emily Watson").fill(patient.name);
    await page.getByPlaceholder("e.g. SSN-9821, PASSPORT-GB-10294").fill(patient.idSecret);
    await page.locator('input[type="password"]').fill("SecureTestKey2026!");

    await page.getByRole("button", { name: "Register & Provision Wallet" }).click();

    // Expect derivation success and zero-PHI badge
    await expect(page.getByText("Patient Registered Successfully!")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Global Pseudonymous ID (Consortium Locator)")).toBeVisible();
  });

  test("5. Real Clinical Record Creation & Off-Chain Storage", async ({ page }) => {
    const recordId = `rec_${Date.now()}`;
    const fileContent = `CLINICAL SCAN ${Date.now()}: Serial MRI scan confirms normal alignment with preserved disc height.`;
    const cipherText = Buffer.from(fileContent).toString("base64");
    
    // Compute SHA-256 hashes
    const crypto = await import("crypto");
    const recordHash = "0x" + crypto.createHash("sha256").update(fileContent).digest("hex");
    const cipherHash = "0x" + crypto.createHash("sha256").update(cipherText).digest("hex");

    const uploadRes = await page.request.post("/api/records/upload", {
      data: {
        recordId,
        patientPseudonym: patient.name,
        recordType: "DiagnosticReport",
        recordHash,
        cipherHash,
        ciphertext: cipherText,
        iv: "0x1234567890abcdef12345678",
        issuerHospital: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        issuerDoctor: doctor.walletAddress,
        issuerSignature: "0xmocksignature123456",
        fileName: "mri-lumbar.txt",
        mimeType: "text/plain",
        fileSize: Buffer.byteLength(cipherText),
      },
    });

    expect(uploadRes.ok()).toBeTruthy();
    const uploadData = await uploadRes.json();
    expect(uploadData.success).toBe(true);
    expect(uploadData.recordId).toBe(recordId);
    createdRecordId = recordId;
  });

  test("6. Cross-Chain Transfer State Machine Progression", async ({ page }) => {
    // 1. Doctor creates transfer request
    const createReq = await page.request.post("/api/transfers", {
      data: {
        action: "CREATE",
        patientPseudonym: patient.name,
        recordId: createdRecordId,
        requestingHospital: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        requestingDoctor: doctor.name,
        reason: "Pre-operative evaluation and surgical assessment",
        scope: "SpecificRecord",
      },
    });
    expect(createReq.ok()).toBeTruthy();
    const createData = await createReq.json();
    expect(createData.transfer.status).toBe("REQUESTED");
    const transferId = createData.transfer.id;

    // 2. Advance to CONSENT_GIVEN
    const approveReq = await page.request.post("/api/transfers", {
      data: {
        action: "TRANSITION",
        transferId,
        targetState: "CONSENT_GIVEN",
      },
    });
    expect(approveReq.ok()).toBeTruthy();
    const approveData = await approveReq.json();
    expect(approveData.currentState).toBe("CONSENT_GIVEN");

    // 3. Advance to RELEASED
    const releaseReq = await page.request.post("/api/transfers", {
      data: {
        action: "TRANSITION",
        transferId,
        targetState: "RELEASED",
      },
    });
    expect(releaseReq.ok()).toBeTruthy();

    // 4. Advance to VERIFIED
    const verifyReq = await page.request.post("/api/transfers", {
      data: {
        action: "TRANSITION",
        transferId,
        targetState: "VERIFIED",
      },
    });
    expect(verifyReq.ok()).toBeTruthy();

    // 5. Advance to AVAILABLE
    const availReq = await page.request.post("/api/transfers", {
      data: {
        action: "TRANSITION",
        transferId,
        targetState: "AVAILABLE",
      },
    });
    expect(availReq.ok()).toBeTruthy();
    const availData = await availReq.json();
    expect(availData.currentState).toBe("AVAILABLE");
  });

  test("7. Mathematical Authenticity Verification (Proof Panel)", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.locator("h1").first()).toContainText("Public Mathematical Record Verifier");

    // Verify verification panel UI elements
    await expect(page.getByRole("button", { name: "Verify Record" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tamper Demo Toggle" })).toBeVisible();
  });

  test("8. Cross-Chain Revocation Enforcement", async ({ page }) => {
    // 1. Create a transfer to revoke
    const res = await page.request.post("/api/transfers", {
      data: {
        action: "CREATE",
        patientPseudonym: `patient_revoke_${timestamp}`,
        requestingHospital: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        requestingDoctor: "Dr. Revoke Tester",
        reason: "Temporary second opinion consultation",
      },
    });
    expect(res.ok()).toBeTruthy();
    const { transfer } = await res.json();

    // 2. Revoke transfer
    const revokeRes = await page.request.post("/api/transfers", {
      data: {
        action: "TRANSITION",
        transferId: transfer.id,
        targetState: "REJECTED",
        rejectionReason: "Immediate patient revocation on source chain",
      },
    });
    expect(revokeRes.ok()).toBeTruthy();
    const revokeData = await revokeRes.json();
    expect(revokeData.currentState).toBe("REJECTED");
  });

  test("9. Emergency Break-Glass Access Flow", async ({ page }) => {
    await page.goto("/doctor/emergency");
    await expect(page.locator("h1").first()).toContainText("Emergency Break-Glass");

    await page.getByPlaceholder("Enter Patient SSN / MRN or 0x... salted pseudonym hash").fill(patient.name);
    await page.getByPlaceholder("Additional patient presentation notes, clinical signs, attending team...").fill("Patient found in unconscious state, acute trauma triage requiring historical records.");
    await page.locator('input[type="checkbox"]').check();

    await page.getByRole("button", { name: "Execute Break-Glass Emergency Access (24h)" }).click();

    // Verify emergency access alert is activated
    await expect(page.getByText("EMERGENCY OVERRIDE ACTIVE")).toBeVisible({ timeout: 15000 });
  });

  test("10. Off-Chain Inspector (Zero-PHI Verification)", async ({ page }) => {
    await page.goto("/admin/inspector");
    await expect(page.locator("h1")).toContainText("Consortium State & Storage Inspector");
    await expect(page.getByText("Cryptographic Zero-PHI Audit Passed")).toBeVisible();
  });

  test("11. Negative Security & Edge Case Tests", async () => {
    const crypto = await import("crypto");

    // 1. Duplicate Record Upload (Idempotency Violation)
    const negRecId = `neg_rec_${Date.now()}`;
    const dummyCipher = "DUMMY_ENCRYPTED_DATA";
    const dummyHash = "0x" + crypto.createHash("sha256").update("DUMMY_PLAINTEXT_" + Date.now()).digest("hex");
    const dummyCipherHash = "0x" + crypto.createHash("sha256").update(dummyCipher).digest("hex");

    const firstUpload = await fetch("http://localhost:3000/api/records/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: negRecId,
        patientPseudonym: "neg_patient_1",
        recordType: "Lab",
        recordHash: dummyHash,
        cipherHash: dummyCipherHash,
        ciphertext: dummyCipher,
        iv: "0xiv12345",
        issuerDoctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        issuerSignature: "0xsig1",
      }),
    });
    expect(firstUpload.status).toBe(200);

    // Duplicate upload must return 409 Conflict
    const secondUpload = await fetch("http://localhost:3000/api/records/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: negRecId,
        patientPseudonym: "neg_patient_1",
        recordType: "Lab",
        recordHash: "0xdifferenthash999999999999999999999999999999999999999999999999999999999999",
        cipherHash: dummyCipherHash,
        ciphertext: dummyCipher,
        iv: "0xiv12345",
        issuerDoctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        issuerSignature: "0xsig2",
      }),
    });
    expect(secondUpload.status).toBe(409);
    const dupJson = await secondUpload.json();
    expect(dupJson.error).toContain("Duplicate record upload");

    // 2. Ciphertext Hash Tamper Detection on Ingestion
    const tamperedCipherRes = await fetch("http://localhost:3000/api/records/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: `tamper_test_${Date.now()}`,
        patientPseudonym: "neg_patient_2",
        recordType: "Lab",
        recordHash: "0x" + crypto.createHash("sha256").update("UNIQUE_TAMPER_TEST_" + Date.now()).digest("hex"),
        cipherHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        ciphertext: dummyCipher,
        iv: "0xiv12345",
        issuerDoctor: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        issuerSignature: "0xsig3",
      }),
    });
    expect(tamperedCipherRes.status).toBe(400);
    const tamperJson = await tamperedCipherRes.json();
    expect(tamperJson.error).toContain("Ciphertext hash mismatch");

    // 3. Duplicate Share on Same Record
    const share1 = await fetch(`http://localhost:3000/api/records/${negRecId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientWallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        wrappedKey: "0xwrappedkey123",
      }),
    });
    expect(share1.status).toBe(200);

    const share2 = await fetch(`http://localhost:3000/api/records/${negRecId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientWallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        wrappedKey: "0xwrappedkey456",
      }),
    });
    expect(share2.status).toBe(409);
    const share2Json = await share2.json();
    expect(share2Json.error).toContain("Duplicate share rejected");

    // 4. Invalid Recipient Key Format
    const badKeyRes = await fetch(`http://localhost:3000/api/records/${negRecId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientWallet: "invalid_key_format",
        wrappedKey: "0xwrappedkey",
      }),
    });
    expect(badKeyRes.status).toBe(400);
    const badKeyJson = await badKeyRes.json();
    expect(badKeyJson.error).toContain("Invalid recipient key");

    // 5. Invalid Transfer State Machine Transition
    const badTransitionRes = await fetch("http://localhost:3000/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TRANSITION",
        transferId: "non_existent_xfer",
        targetState: "VERIFIED",
      }),
    });
    expect(badTransitionRes.status).toBe(404);
  });
});
