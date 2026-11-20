# MediChain: Comprehensive Viva & Oral Examination Q&A

This document contains **45 anticipated questions and concise, rigorous answers** designed for final-year engineering defense committees, external professors, and technical evaluators.

---

## Category 1: System Concept & High-Level Architecture (Q1 – Q8)

#### Q1: What core problem does MediChain solve that traditional Electronic Health Record (EHR) systems fail to address?
**Answer:** Traditional EHR systems (such as Epic or Cerner) create proprietary data silos. When a patient relocates or visits another hospital, cross-institutional data sharing requires manual faxing, unencrypted PDFs, or centralized cloud aggregators that represent catastrophic single points of failure and HIPAA/GDPR liabilities. MediChain enables sovereign hospitals running different blockchains to exchange clinical records with mathematical authenticity proofs, patient-controlled consent, and zero central storage.

#### Q2: Why use blockchain for medical records if blockchain storage is expensive and public?
**Answer:** MediChain **never stores raw medical records on the blockchain**. We use a hybrid architecture: medical files are encrypted off-chain via AES-256-GCM and stored in local repositories. Only cryptographic commitments—specifically dual SHA-256 hashes, doctor digital signatures, and access consent timestamps—are pinned on-chain. This provides tamper-evident immutability and non-repudiation while consuming minimal on-chain storage ($< 200\text{ bytes}$ per record).

#### Q3: What is meant by "Heterogeneous Blockchains" in this project?
**Answer:** Heterogeneous means the participating healthcare institutions do not run identical blockchain software. In MediChain, Network A and Network B are independent Ethereum-compatible EVM chains running Solidity smart contracts, while Network C is a Hyperledger Fabric-style permissioned ledger with state trie indexing. They have different transaction formats, consensus models, and identity schemes.

#### Q4: What are the specific port numbers and Chain IDs of your local consortium?
**Answer:**
- **Network A (City General Hospital):** Port `8545`, Chain ID `31337` (EVM Hardhat/Anvil).
- **Network B (Regional Specialty Hospital):** Port `8546`, Chain ID `31338` (EVM Hardhat/Anvil).
- **Network C (Metro Diagnostics Lab):** Port `9000` (Fabric-style permissioned append-only ledger).
- **Federation Registry Chain:** Port `8547`, Chain ID `31340` (Neutral consortium trust layer).
- **Web Application Client:** Port `3000` (Next.js 14).

#### Q5: How is your system 100% free and open-source?
**Answer:** MediChain uses zero paid third-party APIs, zero cloud subscriptions (AWS/Infura/Alchemy), and zero paid cross-chain services. All blockchain nodes, relational databases, cryptography engines, and web servers execute entirely locally on open-source runtimes (Node.js, Hardhat, SQLite).

#### Q6: Why did you not use a single public blockchain like Ethereum Mainnet or Polygon?
**Answer:** Public blockchains require transaction gas fees for every interaction, expose transaction graphs to public surveillance, and lack sovereign administrative controls required by healthcare laws (HIPAA/GDPR). Hospitals require local sovereign control over their own patient records and consensus policies.

#### Q7: What is the role of the Neutral Federation Layer?
**Answer:** The Federation Layer acts as a root of trust directory. It maintains the list of accredited hospital public keys, tracks member status (Active, Suspended, Revoked), and hosts a privacy-preserving record locator index where patients can be discovered without revealing what medical conditions they have.

#### Q8: Does your system depend on pre-seeded or hardcoded data?
**Answer:** No. MediChain supports a **Clean Start** mode (`npm run start:clean` or `npm run clean-boot`). All hospitals, physicians, patients, and clinical records can be onboarded, registered, and encrypted dynamically from the UI at runtime.

---

## Category 2: Cryptography, Privacy & Zero-PHI (Q9 – Q16)

#### Q9: What is "Zero-PHI" and how do you enforce it?
**Answer:** Zero-PHI (Zero Protected Health Information) means patient-identifying data (names, social security numbers, medical notes, diagnoses) is strictly prohibited from entering the blockchain or transit envelopes. Patients are represented solely by salted cryptographic pseudonyms (`SHA-256(PatientID + SecretSalt)`). Even if an adversary dumps all on-chain blocks and relayer logs, they cannot identify any patient.

#### Q10: Explain the encryption algorithm used for medical files.
**Answer:** We use **AES-256-GCM** (Galois/Counter Mode) authenticated encryption executed natively in the browser via the Web Cryptography API (`crypto.subtle`). It uses a 256-bit symmetric key and a unique 96-bit initialization vector (IV). Alongside ciphertext, it produces a 128-bit authentication tag that guarantees both confidentiality and tamper resistance.

#### Q11: What are the "Dual Hashes" and why are two hashes necessary?
**Answer:**
1. **`recordHash` = `SHA-256(Plaintext)`:** Represents the authentic clinical truth created by the physician. This is the hash the doctor signs with their private key for legal non-repudiation.
2. **`cipherHash` = `SHA-256(Ciphertext)`:** Represents the encrypted file stored on disk. This is pinned to the smart contract so that any off-chain modification of the encrypted file can be detected immediately without needing to decrypt it first.

#### Q12: How does a recipient hospital decrypt a file if the key was created on the source hospital's computer?
**Answer:** Through **ECIES (Elliptic Curve Integrated Encryption Scheme)** over `secp256k1`. When the patient grants consent, the symmetric AES key is re-wrapped (encrypted) using the recipient hospital's public key. The wrapped key travels inside the signed transit envelope. Only the recipient hospital possessing the corresponding private key can unwrap the symmetric key and decrypt the file.

#### Q13: If a doctor leaves the hospital or their key is compromised, can old records be decrypted?
**Answer:** No. Each clinical record is encrypted with a distinct, randomly generated 256-bit ephemeral symmetric key. Compromising one key compromises only that single specific record, preventing systemic data breaches.

#### Q14: What happens if an attacker modifies just one byte of the encrypted file in storage?
**Answer:** MediChain's public verifier recalculates the SHA-256 digest of the stored ciphertext and compares it against the on-chain commitment. A 1-byte difference completely changes the hash due to the avalanche effect, failing the check and triggering an instant red alert: **`INTEGRITY VIOLATION: TAMPERING DETECTED!`**

#### Q15: How does patient authentication work without relying on third-party login providers?
**Answer:** We implement **Sign-In with Ethereum (SIWE - EIP-4361)**. The server generates a cryptographic challenge nonce with a 5-minute expiration. The patient's wallet signs the challenge with their private key, proving ownership of their pseudonymous identity without passwords or centralized credential databases.

#### Q16: What if an evaluator does not have MetaMask installed?
**Answer:** MediChain includes a built-in, password-protected **in-browser encrypted keystore** that automatically generates local `secp256k1` wallets in `localStorage`, allowing evaluators to register patients and sign transactions directly from the UI without browser extensions.

---

## Category 3: Smart Contracts & On-Chain Governance (Q17 – Q24)

#### Q17: What smart contracts are deployed on the EVM networks?
**Answer:**
1. **`AccessControl.sol`:** Manages role-based permissions (`ADMIN_ROLE`, `HOSPITAL_ROLE`, `DOCTOR_ROLE`, `VERIFIER_ROLE`).
2. **`HospitalRegistry.sol`:** Authorizes hospital nodes, rotates gateway keys, and tracks accreditation status.
3. **`RecordRegistry.sol`:** Commits dual hashes, doctor signatures, and storage URIs.
4. **`ConsentManager.sol`:** Manages patient access grants, expiration timestamps, and emergency break-glass protocols.
5. **`FederationRegistry.sol`:** Cross-chain consortium registry and privacy-preserving record locator index.
6. **`AuditLog.sol`:** Append-only log recording access attempts, verifications, and cross-chain transfers.

#### Q18: What Solidity version was used and why?
**Answer:** Solidity `^0.8.24`. It natively handles arithmetic overflow and underflow checks without requiring OpenZeppelin `SafeMath`, utilizes custom errors (`error Unauthorized()`) to optimize gas efficiency, and conforms to modern EVM Cancun opcodes.

#### Q19: How are roles enforced on-chain?
**Answer:** Through function modifiers such as `onlyRole(DOCTOR_ROLE)` and `onlyRole(ADMIN_ROLE)`. If an unauthorized address attempts to register a record or grant emergency access, the contract reverts with an `AccessDenied` custom error.

#### Q20: Can an admin tamper with or delete an anchored medical record?
**Answer:** No. The `RecordRegistry.sol` contract contains no `deleteRecord` or `updateRecordHash` functions. Once anchored, a record is immutable. If a doctor made an error, they must anchor a new version referencing the previous `recordId` (`version: 2`), maintaining an auditable clinical lineage.

#### Q21: What is the "Emergency Break-Glass Protocol"?
**Answer:** In unconscious, life-threatening trauma emergencies where a patient cannot grant consent, an accredited physician can invoke `ConsentManager.sol::emergencyAccess()`. This releases only a **Critical Medical Summary** (blood group, severe allergies, active medications), grants temporary access for 24 hours, logs an immutable audit event, and places the access into the **Federation Admin Review Queue** for mandatory post-hoc review.

#### Q22: Can a non-doctor invoke the Emergency Break-Glass protocol?
**Answer:** No. The smart contract strictly verifies that `msg.sender` holds `DOCTOR_ROLE` issued by an accredited hospital. Non-physicians are rejected on-chain.

#### Q23: What happens when a patient revokes consent?
**Answer:** The patient calls `ConsentManager.sol::revokeConsent(recordId, hospitalAddress)`. The contract sets `isActive = false`. The Interop Hub immediately broadcasts a signed revocation envelope, causing the foreign hospital gateway to purge its decrypted memory cache and lock foreign reference access.

#### Q24: How do you prevent contract vulnerabilities like reentrancy?
**Answer:** All state changes follow the **Checks-Effects-Interactions** pattern. Furthermore, state commitments in our contracts do not perform external calls or transfer Ether/tokens, which fundamentally eliminates classical reentrancy attack surfaces.

---

## Category 4: Cross-Chain Interoperability & Relayer Mechanics (Q25 – Q32)

#### Q25: How does the system communicate between an EVM chain and a Non-EVM ledger?
**Answer:** Through the **ChainAdapter Polymorphic Pattern**. The Interop Hub does not call blockchains directly; it calls a unified `IChainAdapter` interface. The `EvmAdapter` translates calls to Ethers.js JSON-RPC transactions, while the `FabricAdapter` translates calls to Hyperledger Fabric gRPC transactions. The Hub remains completely agnostic to the underlying ledger technology.

#### Q26: What is a "Message Envelope" in MediChain?
**Answer:** A standardized, FHIR-inspired JSON data structure (`v1.0.0`) containing:
- `envelopeId`: Unique message identifier.
- `senderGateway`: Hospital gateway address.
- `recipientGateway`: Destination hospital address.
- `messageType`: `REQUEST_RECORDS`, `RECORD_PACKAGE`, or `REVOCATION_PROPAGATION`.
- `nonce`: Monotonically increasing number for anti-replay protection.
- `timestamp` and `expiresAt`: Message lifetime constraints.
- `payload`: ECIES-wrapped keys, ciphertext hashes, and Merkle inclusion proofs.
- `gatewaySignature`: Cryptographic signature of the sending gateway.

#### Q27: How does MediChain prevent Replay Attacks across chains?
**Answer:** The `InteropHub.ts` engine maintains an in-memory and disk-persisted cache of all processed `(messageId, nonce)` combinations. If an attacker intercepts a legitimate consent grant or record transfer message and attempts to replay it, the Hub rejects it with `Anti-Replay Violation: Nonce already consumed`.

#### Q28: What is an Inclusion Proof?
**Answer:** An inclusion proof is cryptographic evidence proving that a specific transaction or record commitment exists within a specific block on the source chain. On EVM chains, it consists of the block number, transaction hash, and state receipt. On Network C, it includes a Merkle branch proof (`[hash, direction]`) chaining the record to the block's Merkle root.

#### Q29: What happens if the destination hospital's gateway is temporarily offline?
**Answer:** The Interop Hub enqueues the message envelope into a persistent retry queue with **exponential backoff and jitter** ($2\text{s} \rightarrow 4\text{s} \rightarrow 8\text{s} \rightarrow 16\text{s}$). Once the destination gateway comes back online, the message is delivered without data loss.

#### Q30: Why not use Chainlink CCIP or LayerZero for this project?
**Answer:** Chainlink CCIP and LayerZero are designed for public blockchains and require token payments (LINK, ETH) for gas fees. Furthermore, sending medical consent packets through public third-party relayer networks exposes institutional routing metadata, violating clinical confidentiality and HIPAA sovereignty requirements.

#### Q31: What is the "Federation Record Locator"?
**Answer:** It is a privacy-preserving index on the Federation Registry that maps a patient's pseudonymous hash to a list of institution IDs that hold records for them (e.g., `0x88f5...` $\rightarrow$ `[Network A, Network C]`). It contains zero clinical data, allowing doctors at Hospital B to know where to request records without knowing what conditions the patient has. Patients can opt out of the index at any time.

#### Q32: What are the states in the Cross-Chain Transfer State Machine?
**Answer:**
$$\text{REQUESTED} \longrightarrow \text{CONSENT\_GIVEN} \longrightarrow \text{RELEASED} \longrightarrow \text{VERIFIED} \longrightarrow \text{AVAILABLE}$$
Terminal or edge states include: `REJECTED`, `REVOKED`, `EXPIRED`, and `QUEUED_OFFLINE`.

---

## Category 5: Security, Robustness & Edge Cases (Q33 – Q40)

#### Q33: How does the system handle duplicate record uploads?
**Answer:** The upload API (`/api/records/upload`) performs a dual idempotency check:
1. Rejects if `recordId` already exists.
2. Rejects if `recordHash` (clinical plaintext hash) already exists in SQLite.
Both return `409 Conflict: Duplicate record upload`.

#### Q34: What prevents a patient from uploading fake clinical records?
**Answer:** Role enforcement. Only accredited doctors holding `DOCTOR_ROLE` issued by an accredited hospital can sign and anchor clinical records. Patients have read access and consent-granting authority, but cannot invoke `registerRecord`.

#### Q35: What happens if a hospital is suspended by the Consortium Admin?
**Answer:** The Federation Admin calls `FederationRegistry.sol::setInstitutionStatus(id, SUSPENDED)`. The upload API and the Interop Hub immediately reject any record anchoring or message routing originating from or destined to that hospital with `403 Forbidden: Institution is currently suspended`.

#### Q36: What is the maximum file size supported, and how is it enforced?
**Answer:** The system supports up to **25 MB** per clinical file (sufficient for high-resolution DICOM, MRI scans, multi-page PDFs, and lab panels). It is enforced at the API gateway layer (`/api/records/upload`), which immediately returns `413 Payload Too Large` if `effectiveSize > 25 MB`.

#### Q37: How do you handle Unicode filenames and special characters?
**Answer:** Filenames and record IDs are sanitized prior to disk storage: special characters and path traversal attempts (`../`) are stripped using regex (`recordId.replace(/[^a-zA-Z0-9_-]/g, "")`), while original display names are stored securely as UTF-8 strings in SQLite.

#### Q38: How do you prevent man-in-the-middle tampering between the browser and the API?
**Answer:** The server re-computes the SHA-256 hash of the received ciphertext and verifies that `computedCipherHash === submittedCipherHash`. If an interceptor altered the ciphertext in transit, the server rejects the request with `400 Bad Request`.

#### Q39: What prevents an attacker from spamming the Interop Hub with forged messages?
**Answer:** Every message envelope must be digitally signed by an accredited hospital gateway registered in `FederationRegistry.sol`. The Hub verifies the signature using `ethers.verifyMessage`. Messages with unrecognized or forged signatures are discarded immediately.

#### Q40: What happens if a consent grant expires?
**Answer:** Every consent grant includes an on-chain `validUntil` unix timestamp. The `checkConsent()` function on both `ConsentManager.sol` and the `FabricAdapter` compares `block.timestamp <= validUntil`. Once expired, consent checks return `false`, and decryption attempts are rejected.

---

## Category 6: Practical Evaluation & Testing (Q41 – Q45)

#### Q41: How many automated tests exist in the project, and what do they cover?
**Answer:** MediChain has **126 passing automated tests**:
- **32 Solidity Tests:** Smart contract access controls, dual-hash registration, versioning, pause controls, and emergency break-glass.
- **28 Web Tests:** Browser AES-256-GCM encryption, SIWE challenges, replay prevention, and SQLite zero-PHI queries.
- **55 Interop Tests:** Polymorphic adapters, anti-replay routing, exponential backoff retries, and cross-chain relocation flows.
- **11 Playwright E2E Tests:** Complete browser-driven tests running from clean boot in headless Chromium.

#### Q42: How do you run the full test suite?
**Answer:**
```powershell
npm run test:all    # Runs contracts, web, and interop unit/integration suites
npm run test:e2e    # Runs Playwright browser end-to-end tests
```

#### Q43: How can an examiner verify that the database contains zero plaintext?
**Answer:** Navigate to `http://localhost:3000/admin/inspector` or inspect `storage/medichain.db` directly. All clinical columns display hex digests (`0x...`), pseudonyms (`PID-...`), and encrypted base64 strings. There are zero readable diagnostic notes.

#### Q44: What is the purpose of the printable verification certificate?
**Answer:** Accessible via `/verify` and `RecordDetailsModal.tsx`, it generates an official A4 institutional certificate with an authentic QR code, dual SHA-256 hashes, doctor digital signature, and block height commitment, formatted for native PDF printing via `@media print`.

#### Q45: What was the hardest technical challenge in this project and how did you solve it?
**Answer:** Bridging the architectural gap between an account-based EVM chain and a permissioned diagnostic ledger without introducing centralized custody or paid third-party bridges. We solved it by designing the **ChainAdapter Polymorphic Pattern** combined with **ECIES per-recipient key encapsulation**, ensuring that neither blockchain nor the relayer ever holds unencrypted medical data or private keys.
