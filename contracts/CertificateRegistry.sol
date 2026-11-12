// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CertificateRegistry
/// @notice Stores certificate fingerprints, never the underlying documents or personal details.
contract CertificateRegistry {
    address public owner;

    struct Record {
        address issuer;
        uint64 issuedAt;
        bool revoked;
    }

    mapping(bytes32 => Record) private records;

    event CertificateIssued(bytes32 indexed certificateHash, address indexed issuer, uint64 issuedAt);
    event CertificateRevoked(bytes32 indexed certificateHash, address indexed issuer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error InvalidHash();
    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyRevoked();
    error ZeroAddress();

    constructor() { owner = msg.sender; }

    /// @notice Register a SHA-256 certificate fingerprint. Only the owner may issue.
    function issue(bytes32 certificateHash) external {
        if (msg.sender != owner) revert Unauthorized();
        if (certificateHash == bytes32(0)) revert InvalidHash();
        if (records[certificateHash].issuedAt != 0) revert AlreadyRegistered();
        records[certificateHash] = Record(msg.sender, uint64(block.timestamp), false);
        emit CertificateIssued(certificateHash, msg.sender, uint64(block.timestamp));
    }

    /// @notice Revoke a registered certificate. Only the issuing owner may revoke.
    function revoke(bytes32 certificateHash) external {
        if (msg.sender != owner) revert Unauthorized();
        Record storage record = records[certificateHash];
        if (record.issuedAt == 0) revert NotRegistered();
        if (record.revoked) revert AlreadyRevoked();
        record.revoked = true;
        emit CertificateRevoked(certificateHash, msg.sender);
    }

    /// @notice Check whether a fingerprint is registered and not revoked.
    function verify(bytes32 certificateHash) external view returns (bool valid, address issuer, uint64 issuedAt) {
        Record memory record = records[certificateHash];
        return (record.issuedAt != 0 && !record.revoked, record.issuer, record.issuedAt);
    }

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert Unauthorized();
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
