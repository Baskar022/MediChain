// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FederationRegistry
 * @notice Neutral trust and directory registry for the Sovereign Cross-Chain Interoperability Network.
 * @dev Deployed on Ethereum Sepolia (Chain ID: 11155111), owned by a Safe multisig (2-of-3).
 * Governs institution lifecycles (APPLIED -> ACTIVE -> SUSPENDED -> REMOVED), gateway public keys,
 * accredited document hashes, and the privacy-preserving Record Locator Index.
 * ZERO Protected Health Information (PHI) is ever stored on-chain.
 */
contract FederationRegistry is AccessControl, Pausable {
    bytes32 public constant FEDERATION_ADMIN_ROLE = keccak256("FEDERATION_ADMIN_ROLE");

    enum InstitutionType { Hospital, Lab, Clinic }
    enum ChainType { Evm, Algorand, Fabric, PermissionedLedger }
    enum MemberStatus { Inactive, Active, Suspended, Removed, Applied }

    struct Institution {
        bytes32 institutionId;
        string name;
        InstitutionType institutionType;
        ChainType chainType;
        string chainId;
        string gatewayEndpoint;
        bytes gatewayPublicKey;
        bytes32 licenseNumberHash;
        bytes32 documentHash;     // IPFS hash of accredited verification documents
        MemberStatus status;
        uint8 trustLevel;         // 1 to 5 (5 highest)
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
    event InstitutionApplied(
        bytes32 indexed institutionId,
        string name,
        InstitutionType institutionType,
        ChainType chainType,
        string chainId,
        bytes32 licenseNumberHash,
        bytes32 documentHash,
        uint256 timestamp
    );

    event InstitutionApproved(bytes32 indexed institutionId, uint8 trustLevel, uint256 timestamp);

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
        string reason,
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
    error InvalidInstitutionStatus();

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
     * @notice Allows an institution to apply for consortium membership by submitting credentials.
     * Status moves to APPLIED pending Safe multisig review.
     */
    function applyInstitution(
        bytes32 institutionId,
        string calldata name,
        InstitutionType instType,
        ChainType chainType,
        string calldata chainId,
        string calldata gatewayEndpoint,
        bytes calldata gatewayPublicKey,
        bytes32 licenseNumberHash,
        bytes32 documentHash
    ) external whenNotPaused {
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
            licenseNumberHash: licenseNumberHash,
            documentHash: documentHash,
            status: MemberStatus.Applied,
            trustLevel: 1,
            onboardedAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _institutionIds.push(institutionId);

        emit InstitutionApplied(
            institutionId,
            name,
            instType,
            chainType,
            chainId,
            licenseNumberHash,
            documentHash,
            block.timestamp
        );
    }

    /**
     * @notice Approves a pending application. Executed via Safe multisig transaction.
     */
    function approveInstitution(bytes32 institutionId, uint8 trustLevel)
        external
        onlyFederationAdmin
        whenNotPaused
    {
        Institution storage inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0)) revert InstitutionNotFound(institutionId);
        if (inst.status != MemberStatus.Applied && inst.status != MemberStatus.Suspended) {
            revert InvalidInstitutionStatus();
        }

        MemberStatus oldStatus = inst.status;
        inst.status = MemberStatus.Active;
        inst.trustLevel = trustLevel > 5 ? 5 : (trustLevel == 0 ? 1 : trustLevel);
        inst.updatedAt = block.timestamp;

        emit InstitutionStatusUpdated(institutionId, oldStatus, MemberStatus.Active, "Approved by Safe multisig", block.timestamp);
        emit InstitutionApproved(institutionId, inst.trustLevel, block.timestamp);
    }

    /**
     * @notice Direct onboarding by federation admin (e.g., initial setup or pre-vetted member).
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
            licenseNumberHash: bytes32(0),
            documentHash: bytes32(0),
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
     * @notice Suspends an active institution (e.g. compliance investigation).
     */
    function suspendInstitution(bytes32 institutionId, string calldata reason)
        external
        onlyFederationAdmin
        whenNotPaused
    {
        Institution storage inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0)) revert InstitutionNotFound(institutionId);

        MemberStatus oldStatus = inst.status;
        inst.status = MemberStatus.Suspended;
        inst.updatedAt = block.timestamp;

        emit InstitutionStatusUpdated(institutionId, oldStatus, MemberStatus.Suspended, reason, block.timestamp);
    }

    /**
     * @notice Permanently removes an institution from the federation.
     */
    function removeInstitution(bytes32 institutionId, string calldata reason)
        external
        onlyFederationAdmin
        whenNotPaused
    {
        Institution storage inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0)) revert InstitutionNotFound(institutionId);

        MemberStatus oldStatus = inst.status;
        inst.status = MemberStatus.Removed;
        inst.updatedAt = block.timestamp;

        emit InstitutionStatusUpdated(institutionId, oldStatus, MemberStatus.Removed, reason, block.timestamp);
    }

    /**
     * @notice Updates the operational status of an institution.
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

        emit InstitutionStatusUpdated(institutionId, oldStatus, newStatus, "Status updated by admin", block.timestamp);
    }

    /**
     * @notice Allows an institution to rotate its gateway cryptographic public key.
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
     * ZERO clinical content is stored.
     */
    function updateRecordLocator(
        bytes32 globalPatientId,
        bytes32 institutionId,
        string calldata chainIdentifier,
        string calldata recordType,
        uint256 count
    ) external whenNotPaused {
        if (globalPatientId == bytes32(0)) revert InvalidInstitutionId();
        if (_institutions[institutionId].status != MemberStatus.Active) {
            revert UnauthorizedCaller();
        }

        RecordLocatorEntry[] storage entries = _recordLocators[globalPatientId];
        bool found = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].institutionId == institutionId && keccak256(bytes(entries[i].recordType)) == keccak256(bytes(recordType))) {
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
     * @notice Allows a patient to opt out / hide their record locator entry from federated search.
     */
    function togglePatientOptOut(bytes32 globalPatientId, bool optOut) external whenNotPaused {
        _patientOptOut[globalPatientId] = optOut;
        emit PatientVisibilityToggled(globalPatientId, !optOut, block.timestamp);
    }

    /**
     * @notice Compatibility helper for patient visibility.
     */
    function setPatientVisibility(bytes32 globalPatientId, bool isVisible) external whenNotPaused {
        _patientOptOut[globalPatientId] = !isVisible;
        emit PatientVisibilityToggled(globalPatientId, isVisible, block.timestamp);
    }

    /**
     * @notice Queries the Record Locator Index for an authorized patient identifier.
     */
    function getRecordLocations(bytes32 globalPatientId) external view returns (RecordLocatorEntry[] memory) {
        if (_patientOptOut[globalPatientId]) {
            revert PatientLocatorHidden();
        }
        return _recordLocators[globalPatientId];
    }

    /**
     * @notice Compatibility alias for getRecordLocations.
     */
    function getRecordLocator(bytes32 globalPatientId) external view returns (RecordLocatorEntry[] memory) {
        if (_patientOptOut[globalPatientId]) {
            revert PatientLocatorHidden();
        }
        return _recordLocators[globalPatientId];
    }

    function isPatientOptedOut(bytes32 globalPatientId) external view returns (bool) {
        return _patientOptOut[globalPatientId];
    }

    function getInstitution(bytes32 institutionId) external view returns (Institution memory) {
        Institution memory inst = _institutions[institutionId];
        if (inst.institutionId == bytes32(0)) revert InstitutionNotFound(institutionId);
        return inst;
    }

    function isInstitutionActive(bytes32 institutionId) external view returns (bool) {
        return _institutions[institutionId].status == MemberStatus.Active;
    }

    function getAllInstitutionIds() external view returns (bytes32[] memory) {
        return _institutionIds;
    }

    function getInstitutionCount() external view returns (uint256) {
        return _institutionIds.length;
    }

    function pause() external onlyFederationAdmin {
        _pause();
    }

    function unpause() external onlyFederationAdmin {
        _unpause();
    }
}
