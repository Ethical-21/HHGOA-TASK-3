// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerificationRegistry {
    
    struct Record {
        string contentHash;
        string sourceReference;
        uint256 timestamp;
        address submitter;
        bool exists;
    }

    // Mapping from content hash to Record
    mapping(string => Record) public records;

    event RecordStored(string contentHash, string sourceReference, uint256 timestamp, address submitter);

    function storeRecord(string memory _contentHash, string memory _sourceReference) public {
        require(!records[_contentHash].exists, "Record already exists");

        records[_contentHash] = Record({
            contentHash: _contentHash,
            sourceReference: _sourceReference,
            timestamp: block.timestamp,
            submitter: msg.sender,
            exists: true
        });

        emit RecordStored(_contentHash, _sourceReference, block.timestamp, msg.sender);
    }

    function getRecord(string memory _contentHash) public view returns (
        string memory contentHash,
        string memory sourceReference,
        uint256 timestamp,
        address submitter,
        bool exists
    ) {
        Record memory rec = records[_contentHash];
        return (
            rec.contentHash,
            rec.sourceReference,
            rec.timestamp,
            rec.submitter,
            rec.exists
        );
    }
}
