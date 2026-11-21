// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MinimalForwarder
 * @notice ERC-2771 compliant trusted forwarder for gasless meta-transactions.
 * @dev Allows patients and medical practitioners to sign transactions without holding native gas tokens.
 * A designated relayer/gateway wallet submits the transaction and sponsors execution fees.
 */
contract MinimalForwarder is EIP712 {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private constant _TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    mapping(address => uint256) private _nonces;

    event MetaTransactionExecuted(address indexed from, address indexed to, bool success, bytes returnData);

    error InvalidSigner(address recovered, address expected);
    error InvalidNonce(uint256 currentNonce, uint256 providedNonce);
    error CallFailed(bytes returnData);

    constructor() EIP712("MinimalForwarder", "0.0.1") {}

    /**
     * @notice Retrieves the current replay-protection nonce for an account.
     */
    function getNonce(address from) external view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @notice Verifies the validity of an EIP-712 signed forward request.
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _TYPEHASH,
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).recover(signature);

        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    /**
     * @notice Executes a meta-transaction with sponsored gas if signature is authentic.
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        external
        payable
        returns (bool, bytes memory)
    {
        if (_nonces[req.from] != req.nonce) {
            revert InvalidNonce(_nonces[req.from], req.nonce);
        }

        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _TYPEHASH,
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).recover(signature);

        if (signer != req.from) {
            revert InvalidSigner(signer, req.from);
        }

        _nonces[req.from]++;

        // Append the original signer's address to the calldata (ERC-2771 specification)
        (bool success, bytes memory returnData) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        emit MetaTransactionExecuted(req.from, req.to, success, returnData);

        if (!success) {
            revert CallFailed(returnData);
        }

        return (success, returnData);
    }
}
