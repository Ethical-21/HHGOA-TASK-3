import json
import os
from web3 import Web3
from config import settings
from typing import Dict, Any, Tuple

class BlockchainService:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(settings.WEB3_PROVIDER_URI))
        self.contract_address = settings.CONTRACT_ADDRESS
        
        # Load ABI dynamically or hardcode the needed parts
        self.abi = [
            {
                "inputs": [
                    {"internalType": "string", "name": "_contentHash", "type": "string"},
                    {"internalType": "string", "name": "_sourceReference", "type": "string"}
                ],
                "name": "storeRecord",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "string", "name": "_contentHash", "type": "string"}],
                "name": "getRecord",
                "outputs": [
                    {"internalType": "string", "name": "contentHash", "type": "string"},
                    {"internalType": "string", "name": "sourceReference", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "address", "name": "submitter", "type": "address"},
                    {"internalType": "bool", "name": "exists", "type": "bool"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ]
        
        if self.contract_address:
            self.contract = self.w3.eth.contract(address=self.contract_address, abi=self.abi)
            
            # Use the first local account for demonstration (Hardhat defaults)
            if self.w3.is_connected():
                self.account = self.w3.eth.accounts[0]
            else:
                self.account = None
        else:
            self.contract = None
            self.account = None

    def store_hash(self, content_hash: str, source_reference: str) -> Dict[str, Any]:
        """
        Submits a transaction to store the hash on the blockchain.
        """
        if not self.contract or not self.account:
            raise Exception("Blockchain not configured properly. Check CONTRACT_ADDRESS and WEB3_PROVIDER_URI.")
            
        try:
            tx_hash = self.contract.functions.storeRecord(content_hash, source_reference).transact({
                'from': self.account
            })
            
            # Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            return {
                "success": True,
                "transaction_hash": receipt.transactionHash.hex(),
                "block_number": receipt.blockNumber
            }
        except Exception as e:
            if "Record already exists" in str(e):
                # We can consider it a success if it's already there
                return {
                    "success": True,
                    "transaction_hash": "Already Exists",
                    "block_number": "N/A"
                }
            return {"success": False, "error": str(e)}

    def verify_hash(self, content_hash: str) -> Dict[str, Any]:
        """
        Retrieves the record from the blockchain and verifies it exists.
        """
        if not self.contract:
            raise Exception("Blockchain not configured properly.")
            
        try:
            record = self.contract.functions.getRecord(content_hash).call()
            # record = (contentHash, sourceReference, timestamp, submitter, exists)
            exists = record[4]
            
            if exists:
                return {
                    "success": True,
                    "verified": True,
                    "on_chain_hash": record[0],
                    "timestamp": record[2],
                    "submitter": record[3]
                }
            else:
                return {
                    "success": True,
                    "verified": False,
                    "error": "Record not found on blockchain."
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
