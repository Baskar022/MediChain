// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title ForeignRecordRef
 * @notice On-chain ledger for storing and auditing cross-chain medical record references.
 * @dev Deployed on each sovereign hospital chain. Stores attested references to records
 * originating from foreign blockchains (e.g., records transferred from Algorand or Sepolia to Amoy).
 */
contract ForeignRecordRef is AccessControl, Pausable, ReentrancyGuard, ERC2771Context {
    bytes32 public constant GATEWAY_ROLE = keccak256("GATEWAY_ROLE");

    struct Reference {
        bytes32 recordId;
        bytes32 patientIdHash;
        string sourceChain;         // e.g. "ETHEREUM_SEPOLIA", "POLYGON_AMOY", "ALGORAND_TESTNET"
        string sourceInstitution;   // Sovereign hospital/lab ID on originating chain
        bytes32 recordHash;         // Plaintext SHA-256 digest
        bytes32 cipherHash;         // Ciphertext SHA-256 digest
        string storageRef;          // IPFS CID or verifiable storage URI
        bytes attestationSignature; // Gateway cryptographic attestation signature
        uint256 registeredAt;       // Unix timestamp of registration
        bool isRevoked;             // Set true upon receipt of cross-chain revocation envelope
    }

    mapping(bytes32 => Reference) private _references;
    bytes32[] private _allReferenceIds;

    // patientIdHash => list of foreign record IDs
    mapping(bytes32 => bytes32[]) private _patientForeignRecords;

    event ForeignRecordRegistered(
        bytes32 indexed recordId,
        string sourceChain,
        string sourceInstitution,
        bytes32 indexed recordHash,
        bytes32 cipherHash,
        string storageRef,
        uint256 timestamp
    );

    event ForeignRecordRevoked(
        bytes32 indexed recordId,
        string reason,
        uint256 timestamp
    );

    error RecordAlreadyRegistered(bytes32 recordId);
    error RecordNotFound(bytes32 recordId);
    error RecordAlreadyRevoked(bytes32 recordId);
    error InvalidRecordHash();
    error EmptyStorageRef();
    error UnauthorizedGateway();

    constructor(address trustedForwarder, address admin)
        ERC2771Context(trustedForwarder)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GATEWAY_ROLE, admin);
    }

    /**
     * @notice Registers a verified foreign record reference after relayer verification.
     */
    function registerForeignRecord(
        bytes32 recordId,
        bytes32 patientIdHash,
        string calldata sourceChain,
        string calldata sourceInstitution,
        bytes32 recordHash,
        bytes32 cipherHash,
        string calldata storageRef,
        bytes calldata attestationSignature
    ) external onlyRole(GATEWAY_ROLE) whenNotPaused nonReentrant {
        if (recordHash == bytes32(0) || cipherHash == bytes32(0)) revert InvalidRecordHash();
        if (bytes(storageRef).length == 0) revert EmptyStorageRef();
        if (_references[recordId].recordId != bytes32(0)) revert RecordAlreadyRegistered(recordId);

        _references[recordId] = Reference({
            recordId: recordId,
            patientIdHash: patientIdHash,
            sourceChain: sourceChain,
            sourceInstitution: sourceInstitution,
            recordHash: recordHash,
            cipherHash: cipherHash,
            storageRef: storageRef,
            attestationSignature: attestationSignature,
            registeredAt: block.timestamp,
            isRevoked: false
        });

        _allReferenceIds.push(recordId);
        if (patientIdHash != bytes32(0)) {
            _patientForeignRecords[patientIdHash].push(recordId);
        }

        emit ForeignRecordRegistered(
            recordId,
            sourceChain,
            sourceInstitution,
            recordHash,
            cipherHash,
            storageRef,
            block.timestamp
        );
    }

    /**
     * @notice Marks a foreign record reference as revoked when a cross-chain REVOKE envelope arrives.
     */
    function markRevoked(bytes32 recordId, string calldata reason)
        external
        onlyRole(GATEWAY_ROLE)
        whenNotPaused
    {
        Reference storage ref = _references[recordId];
        if (ref.recordId == bytes32(0)) revert RecordNotFound(recordId);
        if (ref.isRevoked) revert RecordAlreadyRevoked(recordId);

        ref.isRevoked = true;
        emit ForeignRecordRevoked(recordId, reason, block.timestamp);
    }

    /**
     * @notice Returns reference details for a foreign record.
     */
    function getForeignRecord(bytes32 recordId) external view returns (Reference memory) {
        Reference memory ref = _references[recordId];
        if (ref.recordId == bytes32(0)) revert RecordNotFound(recordId);
        return ref;
    }

    /**
     * @notice Checks if a foreign record is valid and unrevoked.
     */
    function isForeignRecordValid(bytes32 recordId) external view returns (bool) {
        Reference memory ref = _references[recordId];
        return ref.recordId != bytes32(0) && !ref.isRevoked;
    }

    /**
     * @notice Returns total number of registered foreign records.
     */
    function getTotalForeignRecords() external view returns (uint256) {
        return _allReferenceIds.length;
    }

    /**
     * @notice Returns all foreign record IDs for a patient pseudonym.
     */
    function getPatientForeignRecords(bytes32 patientIdHash) external view returns (bytes32[] memory) {
        return _patientForeignRecords[patientIdHash];
    }

    // ERC-2771 context overrides
    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
