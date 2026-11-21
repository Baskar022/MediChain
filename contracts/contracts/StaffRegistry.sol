// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title StaffRegistry
 * @notice Role and credential registry for healthcare practitioners and laboratory staff.
 * @dev Manages doctors, lab technicians, and registrars with instant on-chain revocation.
 * Supports ERC-2771 meta-transactions so staff operations do not require native gas tokens.
 */
contract StaffRegistry is AccessControl, Pausable, ERC2771Context {
    bytes32 public constant INSTITUTION_ADMIN_ROLE = keccak256("INSTITUTION_ADMIN_ROLE");
    bytes32 public constant DOCTOR_ROLE = keccak256("DOCTOR_ROLE");
    bytes32 public constant LAB_TECH_ROLE = keccak256("LAB_TECH_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum StaffStatus {
        Inactive,
        Active,
        Suspended,
        Revoked
    }

    struct StaffMember {
        address wallet;
        bytes32 roleType;         // DOCTOR_ROLE, LAB_TECH_ROLE, etc.
        string name;
        string licenseNumber;
        StaffStatus status;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    mapping(address => StaffMember) private _staff;
    address[] private _allStaffAddresses;

    event StaffRegistered(address indexed wallet, bytes32 indexed roleType, string name, string licenseNumber, uint256 timestamp);
    event StaffStatusUpdated(address indexed wallet, StaffStatus status, string reason, uint256 timestamp);
    event StaffRevoked(address indexed wallet, uint256 timestamp);

    error ZeroAddressNotAllowed();
    error EmptyStringNotAllowed();
    error StaffAlreadyRegistered(address wallet);
    error StaffNotFound(address wallet);
    error StaffNotActive(address wallet);
    error UnauthorizedCaller();

    constructor(address trustedForwarder, address admin)
        ERC2771Context(trustedForwarder)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(INSTITUTION_ADMIN_ROLE, admin);
    }

    /**
     * @notice Registers a new clinical staff member (doctor, lab technician, etc.).
     */
    function registerStaff(
        address wallet,
        bytes32 roleType,
        string calldata name,
        string calldata licenseNumber
    ) external onlyRole(INSTITUTION_ADMIN_ROLE) whenNotPaused {
        if (wallet == address(0)) revert ZeroAddressNotAllowed();
        if (bytes(name).length == 0 || bytes(licenseNumber).length == 0) revert EmptyStringNotAllowed();
        if (_staff[wallet].wallet != address(0)) revert StaffAlreadyRegistered(wallet);

        _staff[wallet] = StaffMember({
            wallet: wallet,
            roleType: roleType,
            name: name,
            licenseNumber: licenseNumber,
            status: StaffStatus.Active,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _allStaffAddresses.push(wallet);
        _grantRole(roleType, wallet);

        emit StaffRegistered(wallet, roleType, name, licenseNumber, block.timestamp);
    }

    /**
     * @notice Instantly revokes a staff member's credentials and access permissions.
     */
    function revokeStaff(address wallet, string calldata reason)
        external
        onlyRole(INSTITUTION_ADMIN_ROLE)
        whenNotPaused
    {
        StaffMember storage member = _staff[wallet];
        if (member.wallet == address(0)) revert StaffNotFound(wallet);

        member.status = StaffStatus.Revoked;
        member.updatedAt = block.timestamp;

        _revokeRole(member.roleType, wallet);

        emit StaffStatusUpdated(wallet, StaffStatus.Revoked, reason, block.timestamp);
        emit StaffRevoked(wallet, block.timestamp);
    }

    /**
     * @notice Suspends a staff member temporarily.
     */
    function suspendStaff(address wallet, string calldata reason)
        external
        onlyRole(INSTITUTION_ADMIN_ROLE)
        whenNotPaused
    {
        StaffMember storage member = _staff[wallet];
        if (member.wallet == address(0)) revert StaffNotFound(wallet);

        member.status = StaffStatus.Suspended;
        member.updatedAt = block.timestamp;

        _revokeRole(member.roleType, wallet);

        emit StaffStatusUpdated(wallet, StaffStatus.Suspended, reason, block.timestamp);
    }

    /**
     * @notice Reactivates a suspended staff member.
     */
    function reactivateStaff(address wallet)
        external
        onlyRole(INSTITUTION_ADMIN_ROLE)
        whenNotPaused
    {
        StaffMember storage member = _staff[wallet];
        if (member.wallet == address(0)) revert StaffNotFound(wallet);

        member.status = StaffStatus.Active;
        member.updatedAt = block.timestamp;

        _grantRole(member.roleType, wallet);

        emit StaffStatusUpdated(wallet, StaffStatus.Active, "Reactivated by admin", block.timestamp);
    }

    /**
     * @notice Checks if a practitioner holds an active role on-chain.
     */
    function isStaffActive(address wallet, bytes32 requiredRole) external view returns (bool) {
        StaffMember memory member = _staff[wallet];
        return member.status == StaffStatus.Active && hasRole(requiredRole, wallet);
    }

    /**
     * @notice Retrieves staff profile details.
     */
    function getStaff(address wallet) external view returns (StaffMember memory) {
        StaffMember memory member = _staff[wallet];
        if (member.wallet == address(0)) revert StaffNotFound(wallet);
        return member;
    }

    /**
     * @notice Returns count of all registered staff members.
     */
    function getTotalStaff() external view returns (uint256) {
        return _allStaffAddresses.length;
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
