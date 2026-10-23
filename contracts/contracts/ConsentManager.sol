// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./HospitalRegistry.sol";
import "./RecordRegistry.sol";
import "./AuditLog.sol";

/**
 * @title ConsentManager
 * @notice Manages patient-controlled access policies, time-limited consents, and emergency break-glass protocols.
 * @dev Enforces granular permissions (per-record or full-history) with verifiable audit emission.
 */
contract ConsentManager is AccessControl, Pausable, ReentrancyGuard {
    enum AccessScope {
        SpecificRecord,
        AllRecords
    }

    struct ConsentGrant {
        bytes32 consentId;
        bytes32 patientIdHash;
        address patientWallet;
        address hospital;
        bytes32 recordId; // 0 if AllRecords
        AccessScope scope;
        uint256 validUntil;
        bool isActive;
        uint256 grantedAt;
    }

    struct EmergencyAccess {
        bytes32 accessId;
        bytes32 patientIdHash;
        bytes32 recordId;
        address doctor;
        address hospital;
        string justification;
        uint256 accessedAt;
        uint256 validUntil; // 24-hour limit
        bool acknowledged;
    }

    uint256 public constant EMERGENCY_ACCESS_DURATION = 24 hours;

    HospitalRegistry public immutable hospitalRegistry;
    RecordRegistry public immutable recordRegistry;
    AuditLog public immutable auditLog;

    // patientIdHash => owner wallet
    mapping(bytes32 => address) private _patientOwners;

    // consentId => ConsentGrant
    mapping(bytes32 => ConsentGrant) private _consents;
    mapping(bytes32 => bytes32[]) private _patientConsentIds;
    mapping(address => bytes32[]) private _hospitalConsentIds;

    // emergency access tracking
    mapping(bytes32 => EmergencyAccess) private _emergencyAccesses;
    mapping(bytes32 => bytes32[]) private _patientEmergencyAccessIds;
    bytes32[] private _allEmergencyAccessIds;

    event PatientRegistered(bytes32 indexed patientIdHash, address indexed patientWallet, uint256 timestamp);
    event ConsentGranted(
        bytes32 indexed consentId,
        bytes32 indexed patientIdHash,
        address indexed hospital,
        bytes32 recordId,
        AccessScope scope,
        uint256 validUntil,
        uint256 timestamp
    );
    event ConsentRevoked(bytes32 indexed consentId, bytes32 indexed patientIdHash, address indexed hospital, uint256 timestamp);
    event EmergencyAccessRequested(
        bytes32 indexed accessId,
        bytes32 indexed patientIdHash,
        bytes32 indexed recordId,
        address doctor,
        address hospital,
        string justification,
        uint256 validUntil,
        uint256 timestamp
    );
    event EmergencyAccessAcknowledged(bytes32 indexed accessId, bytes32 indexed patientIdHash, address indexed patient, uint256 timestamp);

    error ZeroAddressNotAllowed();
    error InvalidPatientId();
    error UnauthorizedPatient();
    error HospitalNotActive(address hospital);
    error InvalidExpiryTime();
    error ConsentNotFound(bytes32 consentId);
    error ConsentAlreadyRevoked(bytes32 consentId);
    error EmergencyAccessNotFound(bytes32 accessId);
    error UnauthorizedDoctor();
    error EmptyJustification();
    error PatientAlreadyRegistered();

    constructor(
        address initialAdmin,
        address hospitalRegistryAddress,
        address recordRegistryAddress,
        address auditLogAddress
    ) {
        if (
            initialAdmin == address(0) ||
            hospitalRegistryAddress == address(0) ||
            recordRegistryAddress == address(0) ||
            auditLogAddress == address(0)
        ) {
            revert ZeroAddressNotAllowed();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);

        hospitalRegistry = HospitalRegistry(hospitalRegistryAddress);
        recordRegistry = RecordRegistry(recordRegistryAddress);
        auditLog = AuditLog(auditLogAddress);
    }

    /**
     * @notice Registers or claims a patient pseudonymous ID to a wallet address.
     */
    function registerPatient(bytes32 patientIdHash) external whenNotPaused {
        if (patientIdHash == bytes32(0)) revert InvalidPatientId();
        address currentOwner = _patientOwners[patientIdHash];
        if (currentOwner != address(0)) {
            revert PatientAlreadyRegistered();
        }

        _patientOwners[patientIdHash] = msg.sender;
        emit PatientRegistered(patientIdHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Grants access to an authorized hospital for specific record or all records.
     */
    function grantAccess(
        bytes32 patientIdHash,
        address hospital,
        bytes32 recordId,
        AccessScope scope,
        uint256 validUntil
    ) external whenNotPaused nonReentrant returns (bytes32 consentId) {
        if (patientIdHash == bytes32(0)) revert InvalidPatientId();
        if (hospital == address(0)) revert ZeroAddressNotAllowed();
        if (!hospitalRegistry.isHospitalActive(hospital)) revert HospitalNotActive(hospital);
        if (validUntil <= block.timestamp) revert InvalidExpiryTime();

        // Enforce ownership: if patient is registered, only owner can grant
        address owner = _patientOwners[patientIdHash];
        if (owner == address(0)) {
            _patientOwners[patientIdHash] = msg.sender;
            emit PatientRegistered(patientIdHash, msg.sender, block.timestamp);
        } else if (owner != msg.sender) {
            revert UnauthorizedPatient();
        }

        consentId = keccak256(
            abi.encodePacked(patientIdHash, hospital, recordId, scope, validUntil, block.timestamp)
        );

        _consents[consentId] = ConsentGrant({
            consentId: consentId,
            patientIdHash: patientIdHash,
            patientWallet: msg.sender,
            hospital: hospital,
            recordId: recordId,
            scope: scope,
            validUntil: validUntil,
            isActive: true,
            grantedAt: block.timestamp
        });

        _patientConsentIds[patientIdHash].push(consentId);
        _hospitalConsentIds[hospital].push(consentId);

        auditLog.logAccessGranted(recordId, patientIdHash, hospital, msg.sender, validUntil);

        emit ConsentGranted(consentId, patientIdHash, hospital, recordId, scope, validUntil, block.timestamp);
        return consentId;
    }

    /**
     * @notice Revokes a previously granted consent immediately.
     */
    function revokeAccess(bytes32 consentId) external whenNotPaused nonReentrant {
        ConsentGrant storage grant = _consents[consentId];
        if (grant.consentId == bytes32(0)) revert ConsentNotFound(consentId);
        if (!grant.isActive) revert ConsentAlreadyRevoked(consentId);

        address owner = _patientOwners[grant.patientIdHash];
        if (msg.sender != owner && msg.sender != grant.patientWallet && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedPatient();
        }

        grant.isActive = false;

        auditLog.logAccessRevoked(grant.recordId, grant.patientIdHash, grant.hospital, msg.sender);

        emit ConsentRevoked(consentId, grant.patientIdHash, grant.hospital, block.timestamp);
    }

    /**
     * @notice Emergency break-glass protocol invoked by an active physician for life-threatening scenarios.
     * @param patientIdHash Salted hash of patient ID.
     * @param recordId Record to access in emergency.
     * @param justification Clinical reason for accessing record without prior patient consent.
     */
    function requestEmergencyAccess(
        bytes32 patientIdHash,
        bytes32 recordId,
        string calldata justification
    ) external whenNotPaused nonReentrant returns (bytes32 accessId) {
        if (patientIdHash == bytes32(0)) revert InvalidPatientId();
        if (bytes(justification).length == 0) revert EmptyJustification();

        (bool isDocActive, address affiliatedHospital) = hospitalRegistry.isDoctorActive(msg.sender);
        if (!isDocActive) revert UnauthorizedDoctor();

        accessId = keccak256(
            abi.encodePacked(patientIdHash, recordId, msg.sender, block.timestamp, _allEmergencyAccessIds.length)
        );

        uint256 validUntil = block.timestamp + EMERGENCY_ACCESS_DURATION;

        _emergencyAccesses[accessId] = EmergencyAccess({
            accessId: accessId,
            patientIdHash: patientIdHash,
            recordId: recordId,
            doctor: msg.sender,
            hospital: affiliatedHospital,
            justification: justification,
            accessedAt: block.timestamp,
            validUntil: validUntil,
            acknowledged: false
        });

        _patientEmergencyAccessIds[patientIdHash].push(accessId);
        _allEmergencyAccessIds.push(accessId);

        auditLog.logEmergencyAccessTriggered(recordId, patientIdHash, msg.sender, affiliatedHospital, justification);

        emit EmergencyAccessRequested(
            accessId,
            patientIdHash,
            recordId,
            msg.sender,
            affiliatedHospital,
            justification,
            validUntil,
            block.timestamp
        );

        return accessId;
    }

    /**
     * @notice Acknowledges that the patient has reviewed the emergency break-glass event.
     */
    function acknowledgeEmergencyAccess(bytes32 accessId) external whenNotPaused {
        EmergencyAccess storage ea = _emergencyAccesses[accessId];
        if (ea.accessId == bytes32(0)) revert EmergencyAccessNotFound(accessId);

        address owner = _patientOwners[ea.patientIdHash];
        if (owner == address(0)) {
            _patientOwners[ea.patientIdHash] = msg.sender;
            emit PatientRegistered(ea.patientIdHash, msg.sender, block.timestamp);
        } else if (owner != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedPatient();
        }

        ea.acknowledged = true;

        auditLog.logEmergencyAccessAcknowledged(ea.recordId, ea.patientIdHash, msg.sender);
        emit EmergencyAccessAcknowledged(accessId, ea.patientIdHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Verifies whether an accessor (hospital or doctor) is currently authorized to access a record.
     */
    function checkAccess(
        bytes32 patientIdHash,
        bytes32 recordId,
        address accessor
    ) external view returns (bool hasAccess, bool isEmergency, string memory reason) {
        // 1. Check if accessor is the patient owner
        if (_patientOwners[patientIdHash] == accessor) {
            return (true, false, "Patient self-access");
        }

        // 2. Resolve accessor hospital
        address targetHospital = accessor;
        (bool isDocActive, address affiliatedHospital) = hospitalRegistry.isDoctorActive(accessor);
        if (isDocActive) {
            targetHospital = affiliatedHospital;
        }

        // 3. Check active consent grants
        bytes32[] memory consentIds = _patientConsentIds[patientIdHash];
        for (uint256 i = 0; i < consentIds.length; i++) {
            ConsentGrant memory g = _consents[consentIds[i]];
            if (g.isActive && g.hospital == targetHospital && block.timestamp <= g.validUntil) {
                if (g.scope == AccessScope.AllRecords || g.recordId == recordId) {
                    return (true, false, "Active consent grant");
                }
            }
        }

        // 4. Check active break-glass emergency access
        bytes32[] memory emergencyIds = _patientEmergencyAccessIds[patientIdHash];
        for (uint256 i = 0; i < emergencyIds.length; i++) {
            EmergencyAccess memory ea = _emergencyAccesses[emergencyIds[i]];
            if (
                (ea.doctor == accessor || ea.hospital == targetHospital) &&
                (ea.recordId == recordId || recordId == bytes32(0)) &&
                block.timestamp <= ea.validUntil
            ) {
                return (true, true, ea.justification);
            }
        }

        return (false, false, "No valid consent or emergency override found");
    }

    function getPatientOwner(bytes32 patientIdHash) external view returns (address) {
        return _patientOwners[patientIdHash];
    }

    function getConsent(bytes32 consentId) external view returns (ConsentGrant memory) {
        return _consents[consentId];
    }

    function getPatientConsents(bytes32 patientIdHash) external view returns (bytes32[] memory) {
        return _patientConsentIds[patientIdHash];
    }

    function getHospitalConsents(address hospital) external view returns (bytes32[] memory) {
        return _hospitalConsentIds[hospital];
    }

    function getEmergencyAccess(bytes32 accessId) external view returns (EmergencyAccess memory) {
        return _emergencyAccesses[accessId];
    }

    function getPatientEmergencyAccesses(bytes32 patientIdHash) external view returns (bytes32[] memory) {
        return _patientEmergencyAccessIds[patientIdHash];
    }

    function getAllEmergencyAccessIds() external view returns (bytes32[] memory) {
        return _allEmergencyAccessIds;
    }

    function pause() external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert UnauthorizedPatient();
        _pause();
    }

    function unpause() external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert UnauthorizedPatient();
        _unpause();
    }
}
