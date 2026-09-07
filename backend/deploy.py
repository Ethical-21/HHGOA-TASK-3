import json
import os
from web3 import Web3

def deploy():
    # Connect to local Hardhat node
    w3 = Web3(Web3.HTTPProvider('http://127.0.0.1:8545'))
    
    if not w3.is_connected():
        print("Failed to connect to local blockchain.")
        return

    # Set default account to the first Hardhat test account
    w3.eth.default_account = w3.eth.accounts[0]

    # Load compiled contract ABI and Bytecode
    # Path is relative to the backend folder
    artifact_path = os.path.join(os.path.dirname(__file__), "../blockchain/artifacts/contracts/VerificationRegistry.sol/VerificationRegistry.json")
    
    with open(artifact_path, "r") as f:
        artifact = json.load(f)
        
    abi = artifact['abi']
    bytecode = artifact['bytecode']

    # Create contract instance
    VerificationRegistry = w3.eth.contract(abi=abi, bytecode=bytecode)

    print("Deploying VerificationRegistry...")
    
    # Build and send transaction
    tx_hash = VerificationRegistry.constructor().transact()
    
    # Wait for receipt
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    contract_address = tx_receipt.contractAddress
    print(f"Contract deployed to: {contract_address}")
    
    # Save the address
    info = {"address": contract_address}
    out_path = os.path.join(os.path.dirname(__file__), "contract_address.json")
    with open(out_path, "w") as f:
        json.dump(info, f, indent=2)
        
    print("Saved contract_address.json successfully.")

if __name__ == "__main__":
    deploy()
