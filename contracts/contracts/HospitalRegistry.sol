// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title HospitalRegistry
 * @notice Consortium registry for participating healthcare institutions and verified practitioners.
 * @dev Implements role-based access control, cryptographic identity tracking, and lifecycle states.
 */
contract HospitalRegistry is AccessControl, Pausable {
    bytes32 public constant NETWORK_ADMIN_ROLE = keccak256("NETWORK_ADMIN_ROLE");

    enum HospitalStatus {
        Inactive,
        Active,
        Suspended,
        Revoked
    }

    struct Hospital {
        address wallet;
        bytes32 nameHash;
        string name;
        bytes publicKey;
        HospitalStatus status;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    struct Doctor {
        address wallet;
        address hospitalWallet;
        string name;
        string licenseNumber;
        bool isActive;
        uint256 registeredAt;
    }

    // Storage
    mapping(address => Hospital) private _hospitals;
    address[] private _hospitalAddresses;

    mapping(address => Doctor) private _doctors;
    mapping(address => address[]) private _hospitalDoctorAddresses;

    // Events
    event HospitalRegistered(address indexed wallet, bytes32 indexed nameHash, string name, bytes publicKey, uint256 timestamp);
    event HospitalSuspended(address indexed wallet, string reason, uint256 timestamp);
    event HospitalReactivated(address indexed wallet, uint256 timestamp);
    event HospitalRevoked(address indexed wallet, string reason, uint256 timestamp);
    event HospitalPublicKeyUpdated(address indexed wallet, bytes newPublicKey, uint256 timestamp);

    event DoctorRegistered(address indexed doctorWallet, address indexed hospitalWallet, string name, string licenseNumber, uint256 timestamp);
    event DoctorRevoked(address indexed doctorWallet, address indexed hospitalWallet, uint256 timestamp);

    // Custom errors
    error ZeroAddressNotAllowed();
    error EmptyStringNotAllowed();
    error EmptyPublicKeyNotAllowed();
    error HospitalAlreadyRegistered(address wallet);
    error HospitalNotFound(address wallet);
    error HospitalNotActive(address wallet);
    error HospitalAlreadyActive(address wallet);
    error DoctorAlreadyRegistered(address doctorWallet);
    error DoctorNotFound(address doctorWallet);
    error DoctorNotActive(address doctorWallet);
    error UnauthorizedCaller();

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(NETWORK_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddressNotAllowed();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(NETWORK_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Registers a new hospital in the consortium.
     * @param wallet The Ethereum address assigned to the hospital.
     * @param name The legal name of the hospital.
     * @param publicKey The ECIES public key used to wrap AES record keys.
     */
    function registerHospital(
        address wallet,
        string calldata name,
        bytes calldata publicKey
    ) external onlyAdmin whenNotPaused {
        if (wallet == address(0)) revert ZeroAddressNotAllowed();
        if (bytes(name).length == 0) revert EmptyStringNotAllowed();
        if (publicKey.length == 0) revert EmptyPublicKeyNotAllowed();
        if (_hospitals[wallet].wallet != address(0)) revert HospitalAlreadyRegistered(wallet);

        bytes32 nameHash = keccak256(abi.encodePacked(name));
        _hospitals[wallet] = Hospital({
            wallet: wallet,
            nameHash: nameHash,
            name: name,
            publicKey: publicKey,
            status: HospitalStatus.Active,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _hospitalAddresses.push(wallet);

        emit HospitalRegistered(wallet, nameHash, name, publicKey, block.timestamp);
    }

    /**
     * @notice Suspends a hospital temporarily (e.g. pending security review).
     */
    function suspendHospital(address wallet, string calldata reason) external onlyAdmin whenNotPaused {
        Hospital storage h = _hospitals[wallet];
        if (h.wallet == address(0)) revert HospitalNotFound(wallet);
        if (h.status != HospitalStatus.Active) revert HospitalNotActive(wallet);

        h.status = HospitalStatus.Suspended;
        h.updatedAt = block.timestamp;

        emit HospitalSuspended(wallet, reason, block.timestamp);
    }

    /**
     * @notice Reactivates a suspended hospital.
     */
    function reactivateHospital(address wallet) external onlyAdmin whenNotPaused {
        Hospital storage h = _hospitals[wallet];
        if (h.wallet == address(0)) revert HospitalNotFound(wallet);
        if (h.status == HospitalStatus.Active) revert HospitalAlreadyActive(wallet);
        if (h.status == HospitalStatus.Revoked) revert HospitalNotFound(wallet);

        h.status = HospitalStatus.Active;
        h.updatedAt = block.timestamp;

        emit HospitalReactivated(wallet, block.timestamp);
    }

    /**
     * @notice Permanently revokes a hospital from the consortium.
     */
    function revokeHospital(address wallet, string calldata reason) external onlyAdmin whenNotPaused {
        Hospital storage h = _hospitals[wallet];
        if (h.wallet == address(0)) revert HospitalNotFound(wallet);

        h.status = HospitalStatus.Revoked;
        h.updatedAt = block.timestamp;

        emit HospitalRevoked(wallet, reason, block.timestamp);
    }

    /**
     * @notice Allows an active hospital to update its encryption public key.
     */
    function updateHospitalPublicKey(bytes calldata newPublicKey) external whenNotPaused {
        if (newPublicKey.length == 0) revert EmptyPublicKeyNotAllowed();
        Hospital storage h = _hospitals[msg.sender];
        if (h.wallet == address(0)) revert HospitalNotFound(msg.sender);
        if (h.status != HospitalStatus.Active) revert HospitalNotActive(msg.sender);

        h.publicKey = newPublicKey;
        h.updatedAt = block.timestamp;

        emit HospitalPublicKeyUpdated(msg.sender, newPublicKey, block.timestamp);
    }

    /**
     * @notice Registers a licensed doctor under the caller's active hospital.
     */
    function registerDoctor(
        address doctorWallet,
        string calldata name,
        string calldata licenseNumber
    ) external whenNotPaused {
        if (doctorWallet == address(0)) revert ZeroAddressNotAllowed();
        if (bytes(name).length == 0 || bytes(licenseNumber).length == 0) revert EmptyStringNotAllowed();

        Hospital storage h = _hospitals[msg.sender];
        if (h.status != HospitalStatus.Active) revert HospitalNotActive(msg.sender);
        if (_doctors[doctorWallet].wallet != address(0) && _doctors[doctorWallet].isActive) {
            revert DoctorAlreadyRegistered(doctorWallet);
        }

        _doctors[doctorWallet] = Doctor({
            wallet: doctorWallet,
            hospitalWallet: msg.sender,
            name: name,
            licenseNumber: licenseNumber,
            isActive: true,
            registeredAt: block.timestamp
        });

        _hospitalDoctorAddresses[msg.sender].push(doctorWallet);

        emit DoctorRegistered(doctorWallet, msg.sender, name, licenseNumber, block.timestamp);
    }

    /**
     * @notice Revokes a doctor's access to represent a hospital.
     */
    function revokeDoctor(address doctorWallet) external whenNotPaused {
        Doctor storage d = _doctors[doctorWallet];
        if (d.wallet == address(0) || !d.isActive) revert DoctorNotFound(doctorWallet);

        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(NETWORK_ADMIN_ROLE, msg.sender);
        bool isAffiliatedHospital = d.hospitalWallet == msg.sender;

        if (!isAdmin && !isAffiliatedHospital) {
            revert UnauthorizedCaller();
        }

        d.isActive = false;

        emit DoctorRevoked(doctorWallet, d.hospitalWallet, block.timestamp);
    }

    /**
     * @notice Checks whether a given hospital is currently active.
     */
    function isHospitalActive(address wallet) external view returns (bool) {
        return _hospitals[wallet].status == HospitalStatus.Active;
    }

    /**
     * @notice Checks whether a doctor is active and returns their affiliated hospital.
     */
    function isDoctorActive(address doctorWallet) external view returns (bool isActive, address hospitalWallet) {
        Doctor memory d = _doctors[doctorWallet];
        if (!d.isActive) {
            return (false, address(0));
        }
        // Doctor is active only if affiliated hospital is also active
        bool hospitalActive = _hospitals[d.hospitalWallet].status == HospitalStatus.Active;
        return (hospitalActive, d.hospitalWallet);
    }

    /**
     * @notice Returns hospital details.
     */
    function getHospital(address wallet) external view returns (Hospital memory) {
        Hospital memory h = _hospitals[wallet];
        if (h.wallet == address(0)) revert HospitalNotFound(wallet);
        return h;
    }

    /**
     * @notice Returns doctor details.
     */
    function getDoctor(address doctorWallet) external view returns (Doctor memory) {
        Doctor memory d = _doctors[doctorWallet];
        if (d.wallet == address(0)) revert DoctorNotFound(doctorWallet);
        return d;
    }

    /**
     * @notice Returns list of all registered hospital addresses.
     */
    function getAllHospitals() external view returns (address[] memory) {
        return _hospitalAddresses;
    }

    /**
     * @notice Returns doctors registered under a hospital.
     */
    function getDoctorsByHospital(address hospitalWallet) external view returns (address[] memory) {
        return _hospitalDoctorAddresses[hospitalWallet];
    }

    /**
     * @notice Emergency circuit breaker pause.
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @notice Emergency circuit breaker resume.
     */
    function unpause() external onlyAdmin {
        _unpause();
    }
}
