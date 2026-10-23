// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AuditLog
 * @notice Centralized immutable audit trail for MediChain operations.
 * @dev Emits verifiable on-chain events and logs for upload, view, grant, revoke, verify, and break-glass attempts.
 */
contract AuditLog is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    struct AuditEntry {
        bytes32 recordId;
        bytes32 patientIdHash;
        address actor;
        address hospital;
        string action;
        bool authorized;
        string details;
        uint256 timestamp;
    }

    AuditEntry[] private _auditEntries;
    mapping(bytes32 => uint256[]) private _recordAuditIndices;
    mapping(bytes32 => uint256[]) private _patientAuditIndices;

    event RecordUploaded(
        bytes32 indexed recordId,
        bytes32 indexed patientIdHash,
        address indexed hospital,
        address doctor,
        uint256 version,
        uint256 timestamp
    );

    event AccessGranted(
        bytes32 indexed recordId,
        bytes32 indexed patientIdHash,
        address indexed hospital,
        address grantedBy,
        uint256 validUntil,
        uint256 timestamp
    );

    event AccessRevoked(
        bytes32 indexed recordId,
        bytes32 indexed patientIdHash,
        address indexed hospital,
        address revokedBy,
        uint256 timestamp
    );

    event AccessAttempted(
        bytes32 indexed recordId,
        bytes32 indexed patientIdHash,
        address indexed accessor,
        address hospital,
        bool authorized,
        string actionType,
        string details,
        uint256 timestamp
    );

    event EmergencyAccessTriggered(
        bytes32 indexed recordId,
        bytes32 indexed patientIdHash,
        address indexed doctor,
        address hospital,
        string justification,
        uint256 timestamp
    );

    event EmergencyAccessAcknowledged(
        bytes32 indexed recordId,
        bytes32 indexed patientIdHash,
        address indexed patient,
        uint256 timestamp
    );

    event IntegrityVerified(
        bytes32 indexed recordId,
        address indexed verifier,
        bool matched,
        uint256 timestamp
    );

    event RecordRevoked(
        bytes32 indexed recordId,
        address indexed revokedBy,
        string reason,
        uint256 timestamp
    );

    error UnauthorizedCaller();

    modifier onlyRecorder() {
        if (!hasRole(RECORDER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(RECORDER_ROLE, initialAdmin);
    }

    function logRecordUploaded(
        bytes32 recordId,
        bytes32 patientIdHash,
        address hospital,
        address doctor,
        uint256 version
    ) external onlyRecorder {
        _recordEntry(recordId, patientIdHash, doctor, hospital, "RECORD_UPLOADED", true, "");
        emit RecordUploaded(recordId, patientIdHash, hospital, doctor, version, block.timestamp);
    }

    function logAccessGranted(
        bytes32 recordId,
        bytes32 patientIdHash,
        address hospital,
        address grantedBy,
        uint256 validUntil
    ) external onlyRecorder {
        _recordEntry(recordId, patientIdHash, grantedBy, hospital, "ACCESS_GRANTED", true, "");
        emit AccessGranted(recordId, patientIdHash, hospital, grantedBy, validUntil, block.timestamp);
    }

    function logAccessRevoked(
        bytes32 recordId,
        bytes32 patientIdHash,
        address hospital,
        address revokedBy
    ) external onlyRecorder {
        _recordEntry(recordId, patientIdHash, revokedBy, hospital, "ACCESS_REVOKED", true, "");
        emit AccessRevoked(recordId, patientIdHash, hospital, revokedBy, block.timestamp);
    }

    function logAccessAttempted(
        bytes32 recordId,
        bytes32 patientIdHash,
        address accessor,
        address hospital,
        bool authorized,
        string calldata actionType,
        string calldata details
    ) external onlyRecorder {
        _recordEntry(recordId, patientIdHash, accessor, hospital, actionType, authorized, details);
        emit AccessAttempted(recordId, patientIdHash, accessor, hospital, authorized, actionType, details, block.timestamp);
    }

    function logEmergencyAccessTriggered(
        bytes32 recordId,
        bytes32 patientIdHash,
        address doctor,
        address hospital,
        string calldata justification
    ) external onlyRecorder {
        _recordEntry(recordId, patientIdHash, doctor, hospital, "EMERGENCY_BREAK_GLASS", true, justification);
        emit EmergencyAccessTriggered(recordId, patientIdHash, doctor, hospital, justification, block.timestamp);
    }

    function logEmergencyAccessAcknowledged(
        bytes32 recordId,
        bytes32 patientIdHash,
        address patient
    ) external onlyRecorder {
        _recordEntry(recordId, patientIdHash, patient, address(0), "EMERGENCY_ACKNOWLEDGED", true, "");
        emit EmergencyAccessAcknowledged(recordId, patientIdHash, patient, block.timestamp);
    }

    function logIntegrityVerified(
        bytes32 recordId,
        address verifier,
        bool matched
    ) external onlyRecorder {
        _recordEntry(recordId, bytes32(0), verifier, address(0), "INTEGRITY_VERIFIED", matched, "");
        emit IntegrityVerified(recordId, verifier, matched, block.timestamp);
    }

    function logRecordRevoked(
        bytes32 recordId,
        address revokedBy,
        string calldata reason
    ) external onlyRecorder {
        _recordEntry(recordId, bytes32(0), revokedBy, address(0), "RECORD_REVOKED", false, reason);
        emit RecordRevoked(recordId, revokedBy, reason, block.timestamp);
    }

    function _recordEntry(
        bytes32 recordId,
        bytes32 patientIdHash,
        address actor,
        address hospital,
        string memory action,
        bool authorized,
        string memory details
    ) internal {
        uint256 index = _auditEntries.length;
        _auditEntries.push(AuditEntry({
            recordId: recordId,
            patientIdHash: patientIdHash,
            actor: actor,
            hospital: hospital,
            action: action,
            authorized: authorized,
            details: details,
            timestamp: block.timestamp
        }));

        if (recordId != bytes32(0)) {
            _recordAuditIndices[recordId].push(index);
        }
        if (patientIdHash != bytes32(0)) {
            _patientAuditIndices[patientIdHash].push(index);
        }
    }

    function getAuditEntryCount() external view returns (uint256) {
        return _auditEntries.length;
    }

    function getAuditEntry(uint256 index) external view returns (AuditEntry memory) {
        return _auditEntries[index];
    }

    function getAuditIndicesByRecord(bytes32 recordId) external view returns (uint256[] memory) {
        return _recordAuditIndices[recordId];
    }

    function getAuditIndicesByPatient(bytes32 patientIdHash) external view returns (uint256[] memory) {
        return _patientAuditIndices[patientIdHash];
    }
}
