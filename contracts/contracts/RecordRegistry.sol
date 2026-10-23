// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./HospitalRegistry.sol";
import "./AuditLog.sol";

/**
 * @title RecordRegistry
 * @notice Immutable ledger for medical record integrity hashes, cryptographically signed metadata, and versioning.
 * @dev Medical data/PII is NEVER stored on-chain. Only SHA-256 hashes, pseudonymous patient identifiers, and signatures.
 */
contract RecordRegistry is AccessControl, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum RecordType {
        General,
        LabReport,
        Prescription,
        Imaging,
        DischargeSummary
    }

    struct Record {
        bytes32 recordId;
        bytes32 patientIdHash;
        bytes32 recordHash;
        bytes32 cipherHash;
        RecordType recordType;
        address issuerHospital;
        address issuerDoctor;
        bytes issuerSignature;
        string storageRef;
        uint256 version;
        bytes32 previousRecordId;
        bool isValid;
        uint256 timestamp;
    }

    HospitalRegistry public immutable hospitalRegistry;
    AuditLog public immutable auditLog;

    mapping(bytes32 => Record) private _records;
    mapping(bytes32 => bytes32[]) private _patientRecordIds;
    bytes32[] private _allRecordIds;

    event RecordAdded(
        bytes32 indexed recordId,
        bytes32 indexed patientIdHash,
        bytes32 indexed recordHash,
        bytes32 cipherHash,
        RecordType recordType,
        address issuerHospital,
        address issuerDoctor,
        uint256 version,
        string storageRef,
        uint256 timestamp
    );

    event RecordVersionUpdated(
        bytes32 indexed newRecordId,
        bytes32 indexed previousRecordId,
        bytes32 indexed patientIdHash,
        uint256 version,
        uint256 timestamp
    );

    event RecordRevoked(
        bytes32 indexed recordId,
        address indexed revokedBy,
        string reason,
        uint256 timestamp
    );

    error ZeroAddressNotAllowed();
    error InvalidHash();
    error EmptySignature();
    error EmptyStorageRef();
    error RecordNotFound(bytes32 recordId);
    error RecordAlreadyExists(bytes32 recordId);
    error RecordIsRevoked(bytes32 recordId);
    error UnauthorizedIssuer();
    error InvalidIssuerSignature();
    error PreviousRecordNotFound(bytes32 recordId);

    constructor(
        address initialAdmin,
        address hospitalRegistryAddress,
        address auditLogAddress
    ) {
        if (initialAdmin == address(0) || hospitalRegistryAddress == address(0) || auditLogAddress == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(OPERATOR_ROLE, initialAdmin);

        hospitalRegistry = HospitalRegistry(hospitalRegistryAddress);
        auditLog = AuditLog(auditLogAddress);
    }

    /**
     * @notice Registers a new medical record hash on-chain.
     * @param patientIdHash Salted SHA-256 hash of patient identity (pseudonym).
     * @param recordHash SHA-256 hash of the unencrypted plaintext content.
     * @param cipherHash SHA-256 hash of the encrypted payload stored off-chain.
     * @param recordType Category of medical record.
     * @param issuerSignature ECDSA signature created by the issuing doctor/hospital over recordHash.
     * @param storageRef Content address or identifier pointer in off-chain encrypted storage.
     * @return recordId Unique identifier assigned to this record on-chain.
     */
    function addRecord(
        bytes32 patientIdHash,
        bytes32 recordHash,
        bytes32 cipherHash,
        RecordType recordType,
        bytes calldata issuerSignature,
        string calldata storageRef
    ) external whenNotPaused nonReentrant returns (bytes32 recordId) {
        if (patientIdHash == bytes32(0) || recordHash == bytes32(0) || cipherHash == bytes32(0)) {
            revert InvalidHash();
        }
        if (issuerSignature.length == 0) revert EmptySignature();
        if (bytes(storageRef).length == 0) revert EmptyStorageRef();

        (address issuerHospital, address issuerDoctor) = _resolveIssuer(msg.sender);

        // Verify issuer signature against recordHash
        _verifySignature(recordHash, issuerSignature, issuerDoctor != address(0) ? issuerDoctor : issuerHospital);

        recordId = keccak256(
            abi.encodePacked(patientIdHash, recordHash, cipherHash, block.timestamp, _allRecordIds.length)
        );

        if (_records[recordId].recordId != bytes32(0)) {
            revert RecordAlreadyExists(recordId);
        }

        Record storage r = _records[recordId];
        r.recordId = recordId;
        r.patientIdHash = patientIdHash;
        r.recordHash = recordHash;
        r.cipherHash = cipherHash;
        r.recordType = recordType;
        r.issuerHospital = issuerHospital;
        r.issuerDoctor = issuerDoctor;
        r.issuerSignature = issuerSignature;
        r.storageRef = storageRef;
        r.version = 1;
        r.previousRecordId = bytes32(0);
        r.isValid = true;
        r.timestamp = block.timestamp;

        _patientRecordIds[patientIdHash].push(recordId);
        _allRecordIds.push(recordId);

        auditLog.logRecordUploaded(recordId, patientIdHash, issuerHospital, issuerDoctor, 1);

        emit RecordAdded(
            recordId,
            patientIdHash,
            recordHash,
            cipherHash,
            recordType,
            issuerHospital,
            issuerDoctor,
            1,
            storageRef,
            block.timestamp
        );

        return recordId;
    }

    /**
     * @notice Appends a new immutable version of an existing record, linking to the previous version.
     */
    function updateRecordVersion(
        bytes32 previousRecordId,
        bytes32 recordHash,
        bytes32 cipherHash,
        bytes calldata issuerSignature,
        string calldata storageRef
    ) external whenNotPaused nonReentrant returns (bytes32 newRecordId) {
        Record memory prev = _records[previousRecordId];
        if (prev.recordId == bytes32(0)) revert PreviousRecordNotFound(previousRecordId);
        if (!prev.isValid) revert RecordIsRevoked(previousRecordId);
        if (recordHash == bytes32(0) || cipherHash == bytes32(0)) revert InvalidHash();
        if (issuerSignature.length == 0) revert EmptySignature();
        if (bytes(storageRef).length == 0) revert EmptyStorageRef();

        (address issuerHospital, address issuerDoctor) = _resolveIssuer(msg.sender);

        // Must be issued by authorized doctor/hospital
        _verifySignature(recordHash, issuerSignature, issuerDoctor != address(0) ? issuerDoctor : issuerHospital);

        newRecordId = keccak256(
            abi.encodePacked(prev.patientIdHash, recordHash, cipherHash, block.timestamp, prev.version + 1)
        );

        Record storage r = _records[newRecordId];
        r.recordId = newRecordId;
        r.patientIdHash = prev.patientIdHash;
        r.recordHash = recordHash;
        r.cipherHash = cipherHash;
        r.recordType = prev.recordType;
        r.issuerHospital = issuerHospital;
        r.issuerDoctor = issuerDoctor;
        r.issuerSignature = issuerSignature;
        r.storageRef = storageRef;
        r.version = prev.version + 1;
        r.previousRecordId = previousRecordId;
        r.isValid = true;
        r.timestamp = block.timestamp;

        _patientRecordIds[prev.patientIdHash].push(newRecordId);
        _allRecordIds.push(newRecordId);

        auditLog.logRecordUploaded(newRecordId, prev.patientIdHash, issuerHospital, issuerDoctor, r.version);

        emit RecordVersionUpdated(newRecordId, previousRecordId, prev.patientIdHash, r.version, block.timestamp);

        return newRecordId;
    }

    /**
     * @notice Marks a record as revoked without deleting historical data.
     */
    function revokeRecord(bytes32 recordId, string calldata reason) external whenNotPaused {
        Record storage r = _records[recordId];
        if (r.recordId == bytes32(0)) revert RecordNotFound(recordId);
        if (!r.isValid) revert RecordIsRevoked(recordId);

        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isOriginalHospital = r.issuerHospital == msg.sender;
        bool isOriginalDoctor = r.issuerDoctor == msg.sender;

        if (!isAdmin && !isOriginalHospital && !isOriginalDoctor) {
            revert UnauthorizedIssuer();
        }

        r.isValid = false;

        auditLog.logRecordRevoked(recordId, msg.sender, reason);

        emit RecordRevoked(recordId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Performs public mathematical verification of a record against provided plaintext and ciphertext hashes.
     */
    function verifyRecordIntegrity(
        bytes32 recordId,
        bytes32 computedPlainHash,
        bytes32 computedCipherHash
    ) external view returns (bool isIntegrityValid, bool isSignatureValid, address recoveredSigner) {
        Record memory r = _records[recordId];
        if (r.recordId == bytes32(0)) revert RecordNotFound(recordId);

        bool plainMatches = (r.recordHash == computedPlainHash);
        bool cipherMatches = (r.cipherHash == computedCipherHash);
        isIntegrityValid = (plainMatches && cipherMatches && r.isValid);

        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(r.recordHash);
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(ethHash, r.issuerSignature);
        if (err == ECDSA.RecoverError.NoError) {
            recoveredSigner = recovered;
            isSignatureValid = (recovered == r.issuerDoctor || recovered == r.issuerHospital);
        } else {
            recoveredSigner = address(0);
            isSignatureValid = false;
        }

        return (isIntegrityValid, isSignatureValid, recoveredSigner);
    }

    function getRecordMeta(bytes32 recordId) external view returns (Record memory) {
        Record memory r = _records[recordId];
        if (r.recordId == bytes32(0)) revert RecordNotFound(recordId);
        return r;
    }

    function getPatientRecordCount(bytes32 patientIdHash) external view returns (uint256) {
        return _patientRecordIds[patientIdHash].length;
    }

    function getPatientRecordByIndex(bytes32 patientIdHash, uint256 index) external view returns (bytes32) {
        return _patientRecordIds[patientIdHash][index];
    }

    function getPatientRecordIds(bytes32 patientIdHash) external view returns (bytes32[] memory) {
        return _patientRecordIds[patientIdHash];
    }

    function getAllRecordCount() external view returns (uint256) {
        return _allRecordIds.length;
    }

    function getAllRecordIds() external view returns (bytes32[] memory) {
        return _allRecordIds;
    }

    function _resolveIssuer(address sender) internal view returns (address hospital, address doctor) {
        if (hospitalRegistry.isHospitalActive(sender)) {
            return (sender, address(0));
        }

        (bool isDocActive, address affiliatedHospital) = hospitalRegistry.isDoctorActive(sender);
        if (isDocActive) {
            return (affiliatedHospital, sender);
        }

        revert UnauthorizedIssuer();
    }

    function _verifySignature(bytes32 hash, bytes calldata signature, address expectedSigner) internal pure {
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address recovered = ethHash.recover(signature);
        if (recovered != expectedSigner) {
            revert InvalidIssuerSignature();
        }
    }

    function pause() external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert UnauthorizedIssuer();
        _pause();
    }

    function unpause() external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert UnauthorizedIssuer();
        _unpause();
    }
}
