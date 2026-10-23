// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FederationRegistry
 * @notice Neutral trust and directory registry for the MediChain Cross-Chain Interoperability Network.
 * @dev Deployed on the Federation Chain (Chain ID: 31340, Port 8547).
 * Stores member institutions (Hospitals, Labs, Clinics), their sovereign chain metadata,
 * gateway public keys, trust levels, and the privacy-preserving Record Locator Index.
 * ZERO Protected Health Information (PHI) is ever stored.
 */
contract FederationRegistry is AccessControl, Pausable {
    bytes32 public constant FEDERATION_ADMIN_ROLE = keccak256("FEDERATION_ADMIN_ROLE");

    enum InstitutionType { Hospital, Lab, Clinic }
    enum ChainType { Evm, PermissionedLedger }
    enum MemberStatus { Inactive, Active, Suspended, Revoked }

    struct Institution {
        bytes32 institutionId;
        string name;
        InstitutionType institutionType;
        ChainType chainType;
        string chainId;
        string gatewayEndpoint;
        bytes gatewayPublicKey;
        MemberStatus status;
        uint8 trustLevel; // 1 to 5 (5 highest)
        uint256 onboardedAt;
        uint256 updatedAt;
    }

    struct RecordLocatorEntry {
        bytes32 institutionId;
        string chainIdentifier;
        string recordType;
        uint256 recordCount;
        uint256 lastUpdatedAt;
    }

    // Storage
    mapping(bytes32 => Institution) private _institutions;
    bytes32[] private _institutionIds;

    // Record Locator: globalPatientId -> array of RecordLocatorEntry
    mapping(bytes32 => RecordLocatorEntry[]) private _recordLocators;

    // Patient visibility preference: globalPatientId -> isVisible (defaults to true)
    mapping(bytes32 => bool) private _patientOptOut;

    // Events
    event InstitutionOnboarded(
        bytes32 indexed institutionId,
        string name,
        InstitutionType institutionType,
        ChainType chainType,
        string chainId,
        bytes gatewayPublicKey,
        uint8 trustLevel,
        uint256 timestamp
    );

    event InstitutionStatusUpdated(
        bytes32 indexed institutionId,
        MemberStatus oldStatus,
        MemberStatus newStatus,
        uint256 timestamp
    );

    event GatewayPublicKeyUpdated(
        bytes32 indexed institutionId,
        bytes newPublicKey,
        uint256 timestamp
    );

    event RecordLocatorUpdated(
        bytes32 indexed globalPatientId,
        bytes32 indexed institutionId,
        string recordType,
        uint256 count,
        uint256 timestamp
    );

    event PatientVisibilityToggled(
        bytes32 indexed globalPatientId,
        bool isVisible,
        uint256 timestamp
    );

    // Custom errors
    error InstitutionAlreadyExists(bytes32 institutionId);
    error InstitutionNotFound(bytes32 institutionId);
    error InvalidInstitutionId();
    error InvalidPublicKey();
    error UnauthorizedCaller();
    error PatientLocatorHidden();

    modifier onlyFederationAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(FEDERATION_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert UnauthorizedCaller();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(FEDERATION_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Onboards an autonomous healthcare institution or lab into the Federation.
     */
    function onboardInstitution(
        bytes32 institutionId,
        string calldata name,
        InstitutionType instType,
        ChainType chainType,
        string calldata chainId,
        string calldata gatewayEndpoint,
        bytes calldata gatewayPublicKey,
        uint8 trustLevel
    ) external onlyFederationAdmin whenNotPaused {
        if (institutionId == bytes32(0)) revert InvalidInstitutionId();
        if (gatewayPublicKey.length == 0) revert InvalidPublicKey();
        if (_institutions[institutionId].institutionId != bytes32(0)) {
            revert InstitutionAlreadyExists(institutionId);
        }

        _institutions[institutionId] = Institution({
            institutionId: institutionId,
            name: name,
            institutionType: instType,
            chainType: chainType,
            chainId: chainId,
            gatewayEndpoint: gatewayEndpoint,
            gatewayPublicKey: gatewayPublicKey,
            status: MemberStatus.Active,
            trustLevel: trustLevel > 5 ? 5 : (trustLevel == 0 ? 1 : trustLevel),
            onboardedAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _institutionIds.push(institutionId);

        emit InstitutionOnboarded(
            institutionId,
            name,
            instType,
            chainType,
            chainId,
            gatewayPublicKey,
            trustLevel,
            block.timestamp
        );
    }

    /**
     * @notice Updates the operational status of an institution (Active, Suspended, Revoked).
     */
    function updateInstitutionStatus(
        bytes32 institutionId,
        MemberStatus newStatus
    ) external onlyFederationAdmin whenNotPaused {
        Institution storage inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0)) revert InstitutionNotFound(institutionId);

        MemberStatus oldStatus = inst.status;
        inst.status = newStatus;
        inst.updatedAt = block.timestamp;

        emit InstitutionStatusUpdated(institutionId, oldStatus, newStatus, block.timestamp);
    }

    /**
     * @notice Allows an institution or admin to rotate its gateway cryptographic public key.
     */
    function updateGatewayPublicKey(
        bytes32 institutionId,
        bytes calldata newPublicKey
    ) external onlyFederationAdmin whenNotPaused {
        if (newPublicKey.length == 0) revert InvalidPublicKey();
        Institution storage inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0)) revert InstitutionNotFound(institutionId);

        inst.gatewayPublicKey = newPublicKey;
        inst.updatedAt = block.timestamp;

        emit GatewayPublicKeyUpdated(institutionId, newPublicKey, block.timestamp);
    }

    /**
     * @notice Updates the Record Locator Index for a patient.
     * Tells the federation that an institution holds a certain number of records of a given category.
     * ZERO clinical content is stored.
     */
    function updateRecordLocator(
        bytes32 globalPatientId,
        bytes32 institutionId,
        string calldata chainIdentifier,
        string calldata recordType,
        uint256 count
    ) external whenNotPaused {
        Institution memory inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0) || inst.status != MemberStatus.Active) {
            revert InstitutionNotFound(institutionId);
        }

        RecordLocatorEntry[] storage entries = _recordLocators[globalPatientId];
        bool found = false;

        for (uint256 i = 0; i < entries.length; i++) {
            if (
                entries[i].institutionId == institutionId &&
                keccak256(bytes(entries[i].recordType)) == keccak256(bytes(recordType))
            ) {
                entries[i].recordCount = count;
                entries[i].lastUpdatedAt = block.timestamp;
                found = true;
                break;
            }
        }

        if (!found) {
            entries.push(RecordLocatorEntry({
                institutionId: institutionId,
                chainIdentifier: chainIdentifier,
                recordType: recordType,
                recordCount: count,
                lastUpdatedAt: block.timestamp
            }));
        }

        emit RecordLocatorUpdated(globalPatientId, institutionId, recordType, count, block.timestamp);
    }

    /**
     * @notice Retrieves the Record Locator Index for a patient.
     * Returns where records exist across institutions and sovereign chains.
     */
    function getRecordLocator(
        bytes32 globalPatientId
    ) external view returns (RecordLocatorEntry[] memory) {
        if (_patientOptOut[globalPatientId]) {
            revert PatientLocatorHidden();
        }
        return _recordLocators[globalPatientId];
    }

    /**
     * @notice Allows a patient to opt out / hide their record locator index across the federation.
     */
    function setPatientVisibility(bytes32 globalPatientId, bool isVisible) external {
        _patientOptOut[globalPatientId] = !isVisible;
        emit PatientVisibilityToggled(globalPatientId, isVisible, block.timestamp);
    }

    /**
     * @notice Checks if an institution is currently active in the Federation.
     */
    function isInstitutionActive(bytes32 institutionId) external view returns (bool) {
        return _institutions[institutionId].status == MemberStatus.Active;
    }

    /**
     * @notice Returns details of a specific member institution.
     */
    function getInstitution(bytes32 institutionId) external view returns (Institution memory) {
        Institution memory inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0)) revert InstitutionNotFound(institutionId);
        return inst;
    }

    /**
     * @notice Returns list of all member institution IDs.
     */
    function getAllInstitutionIds() external view returns (bytes32[] memory) {
        return _institutionIds;
    }

    /**
     * @notice Emergency freeze on federation operations.
     */
    function pause() external onlyFederationAdmin {
        _pause();
    }

    /**
     * @notice Resumes federation operations.
     */
    function unpause() external onlyFederationAdmin {
        _unpause();
    }
}
