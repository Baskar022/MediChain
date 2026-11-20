# MediChain: 10-Minute Live Examination Demo Script

This script is structured for final-year engineering evaluations, technical symposiums, and live academic defenses. It walks through a complete end-to-end demonstration starting from an empty system (**Clean Start**) and includes a dedicated test matrix for what technical examiners might attempt.

---

## Part 1: Pre-Demo Setup & Clean Boot (1 Minute)

### 1. Wipe and Clean Boot
In PowerShell, open the project root and run:
```powershell
npm run clean-boot
```
*What this does:*
- Wipes old SQLite tables (`storage/medichain.db`) and encrypted files (`storage/*.enc`).
- Resets Network C ledger (`storage/ledger-network-c.json`).
- Deploys fresh contracts to Network A (Port 8545), Network B (Port 8546), and Federation Registry (Port 8547).
- Boots the Next.js clinical portal at `http://localhost:3000`.

### 2. Check Cluster Telemetry
In a second terminal, run:
```powershell
npm run status
```
Show the examiners that all four sovereign networks are online and reporting 0 clinical records.

---

## Part 2: Step-by-Step 10-Minute Live Presentation

```
Timeline:
0:00 - 1:30  ──> Onboarding Heterogeneous Hospital & Lab from UI
1:30 - 3:00  ──> Doctor Provisioning & Patient Identity Registration
3:00 - 5:00  ──> Clinical Record Upload (Real 15MB File + AES-256-GCM)
5:00 - 7:00  ──> Cross-Chain Request & Patient Consent Grant
7:00 - 8:30  ──> Proof Verification & Printable Official Certificate
8:30 - 10:00 ──> Live Adversarial Tamper Demo & Zero-PHI Inspector
```

### Stage 1: Runtime Institution Onboarding (No Hardcoded Data)
1. Open browser to `http://localhost:3000`.
2. Click **"Access Consortium Portal"** $\rightarrow$ Navigate to **Federation Registry** (`/admin/federation`).
3. Click **"Onboard Autonomous Institution"**:
   - Institution Name: `Metro South Medical Center`
   - Network Type: Select `EVM Compatible (Port 8545)`
   - Gateway Address: Click `Generate In-Browser Keypair`
   - Click **"Register Institution in Federation"**
4. *Examiner Takeaway:* Prove that the system requires zero pre-seeded institutions; new sovereign participants join at runtime via smart contract transactions.

### Stage 2: Physician Provisioning & Patient Identity Creation
1. Switch to **Consortium Admin** $\rightarrow$ Open **Hospital Consortium Registry** (`/admin/hospitals`).
2. Register a new physician under the hospital:
   - Doctor Name: `Dr. Elena Rostova, MD (Neurology)`
   - License ID: `LIC-NEURO-2026-9921`
   - Wallet Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Click **"Authorize Physician"** (enforced on `AccessControl.sol`).
3. Open **Register Sovereign Patient** (`/patient/register`):
   - Full Legal Name: `Marcus Holloway`
   - National Health ID: `NHI-8849-2026`
   - Click **"Derive Global Identity & Create Keystore"**
   - *Point out:* The browser derives a salted SHA-256 hash `PID-xxxx`. The human name is never committed to the blockchain.

### Stage 3: Clinical Record Upload & Client-Side Encryption
1. Switch role to **DOCTOR** $\rightarrow$ Open **Upload & Sign Record** (`/doctor/upload`).
2. Drag and drop any real medical document (PDF, JPG, or TXT up to 25 MB).
3. Fill in fields:
   - Patient ID: Select `Marcus Holloway` (`PID-...`)
   - Record Type: `Diagnostic Imaging (Brain MRI)`
   - Diagnosis Summary: `Normal cranial anatomy with no acute intracranial pathology`
4. Click **"Sign & Anchor Record"**:
   - *Point out what happens:*
     - Browser encrypts file locally with AES-256-GCM.
     - Computes dual SHA-256 hashes (`recordHash` and `cipherHash`).
     - Doctor's wallet signs `recordHash` via ECDSA.
     - Pinned to `RecordRegistry.sol` on Network A.

### Stage 4: Cross-Chain Transfer to Non-EVM Lab (Network C)
1. Open **Patient Directory & Records** (`/doctor/records`).
2. Find the uploaded record and click **"Initiate Cross-Chain Transfer"**:
   - Target Network: Select `Metro Diagnostics Lab (Fabric-Style Simulated Ledger 9000)`
   - Reason: `Specialized Neuropathology Review`
   - Click **"Request Transfer"**
3. Switch role to **PATIENT** $\rightarrow$ Open **Access Consents** (`/patient/consents`):
   - Locate the incoming transfer request from Metro Diagnostics Lab.
   - Click **"Grant Consent & Re-wrap Key (ECIES)"** (Sets 30-day expiration).
4. Watch the State Machine transition live:
   $$\text{REQUESTED} \longrightarrow \text{CONSENT\_GIVEN} \longrightarrow \text{RELEASED} \longrightarrow \text{VERIFIED} \longrightarrow \text{AVAILABLE}$$

### Stage 5: Mathematical Verification & Official Certificate
1. Open the **Public Verifier** (`/verify`).
2. Drop the newly created `.enc` file from `storage/` (or paste its Record ID).
3. Click **"Verify Record"**:
   - Watch all 7 cryptographic checks pass:
     1. Federation Membership: Active
     2. Gateway Attestation: Valid secp256k1 signature
     3. Physician Signature: Legally attested by Dr. Rostova
     4. Hash Match: Plaintext & Ciphertext hashes identical
     5. Inclusion Proof: Confirmed in Block #$N$
     6. Consent Status: Active & within valid date range
     7. Revocation Check: Unrevoked
4. Click **"Official Certificate"**:
   - Displays the official A4 institutional certificate with authentic QR code.
   - Click **"Print Official Certificate"** to show native PDF preview.

### Stage 6: The Adversarial Tamper Demo & Database Inspection
1. In the Verifier or at `/demo/tamper`, toggle the **"Tamper Demo Toggle"**:
   - System intentionally modifies a single byte in the stored ciphertext.
   - Re-runs verification $\rightarrow$ Triggers instant red alert: **`INTEGRITY VIOLATION: TAMPERING DETECTED!`**
   - Shows exact step failure at Step 4 (*Ciphertext Hash Mismatch*).
2. Open the **Zero-PHI Storage Inspector** (`/admin/inspector`):
   - Show examiners the raw SQLite table rows:
     - `records`: Displays `record_hash`, `cipher_hash`, and encrypted paths.
     - Prove that neither patient names nor medical notes exist in any database column.

---

## Part 3: What an Examiner Might Try (Live Attack Checklist)

| # | Examiner Action | How to Demonstrate Live | Expected Result & Code Safeguard |
|---|---|---|---|
| **1** | **Upload a file larger than 25 MB** | Try uploading a 30 MB video/ISO on `/doctor/upload`. | Rejected immediately with `413 Payload Too Large` in `/api/records/upload/route.ts`. |
| **2** | **Upload the exact same record twice** | Click Upload twice with identical file content. | Rejected with `409 Conflict: Duplicate record upload` (anti-collision check). |
| **3** | **Forge a Doctor's signature** | Alter the signature payload or upload with unauthorized wallet. | Rejected on-chain by `RecordRegistry.sol::registerRecord` (`ecrecover` mismatch). |
| **4** | **Patient revokes consent mid-transit** | In `/patient/consents`, click **"Revoke Access"** for Metro Lab. | Status changes to `REVOKED`. Subsequent verification or decrypt attempts return `403 Forbidden`. |
| **5** | **Direct database inspection for leaked PHI** | Open `storage/medichain.db` via SQLite viewer or terminal. | All clinical text is absent. Only hex hashes (`0x...`), pseudonyms, and base64 ciphertexts exist. |
| **6** | **Tamper with on-disk encrypted file** | Edit one character inside `storage/*.enc` using Notepad. | Verification at `/verify` triggers `TAMPER_DETECTED` instantly. |
| **7** | **Emergency Break-Glass abuse** | Trigger Emergency access under `/doctor/emergency` with a non-doctor account. | Rejected by `ConsentManager.sol::emergencyAccess` (`Caller is not an accredited physician`). |
| **8** | **Replay attack on Interop Hub** | Re-send an identical message envelope with previously used nonce. | Rejected by `InteropHub.ts` with `Anti-Replay Violation: Nonce already consumed`. |
