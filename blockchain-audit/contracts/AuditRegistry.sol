// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract AuditRegistry {

    // Wallet that deployed the contract
    address public owner;

    struct AuditRecord {
        bytes32 auditHash;
        uint256 timestamp;
        address recordedBy;
    }

    // One application can have MANY audit records
    mapping(string => AuditRecord[]) private auditRecords;

    event AuditRecorded(
        string applicationId,
        uint256 auditIndex,
        bytes32 auditHash,
        uint256 timestamp,
        address recordedBy
    );

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Not authorized"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // -----------------------------------------
    // Record a NEW audit
    // -----------------------------------------
    function recordAudit(
        string memory applicationId,
        bytes32 auditHash
    )
        public
        onlyOwner
    {
        auditRecords[applicationId].push(
            AuditRecord({
                auditHash: auditHash,
                timestamp: block.timestamp,
                recordedBy: msg.sender
            })
        );

        uint256 auditIndex =
            auditRecords[applicationId].length - 1;

        emit AuditRecorded(
            applicationId,
            auditIndex,
            auditHash,
            block.timestamp,
            msg.sender
        );
    }

    // -----------------------------------------
    // Get number of audits for application
    // -----------------------------------------
    function getAuditCount(
        string memory applicationId
    )
        public
        view
        returns (uint256)
    {
        return auditRecords[applicationId].length;
    }

    // -----------------------------------------
    // Get specific audit
    // -----------------------------------------
    function getAudit(
        string memory applicationId,
        uint256 auditIndex
    )
        public
        view
        returns (
            bytes32 auditHash,
            uint256 timestamp,
            address recordedBy
        )
    {
        require(
            auditIndex < auditRecords[applicationId].length,
            "Invalid audit index"
        );

        AuditRecord memory record =
            auditRecords[applicationId][auditIndex];

        return (
            record.auditHash,
            record.timestamp,
            record.recordedBy
        );
    }
}