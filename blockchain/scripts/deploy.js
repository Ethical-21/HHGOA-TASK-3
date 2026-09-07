import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const VerificationRegistry = await hre.ethers.getContractFactory("VerificationRegistry");
  const registry = await VerificationRegistry.deploy();

  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log(`VerificationRegistry deployed to: ${address}`);

  const info = {
    address: address
  };
  // Ensure the backend folder exists before writing
  const backendDir = path.join(__dirname, "../../backend");
  if (!fs.existsSync(backendDir)) {
    fs.mkdirSync(backendDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(backendDir, "contract_address.json"),
    JSON.stringify(info, null, 2)
  );
  console.log("Contract address saved for backend.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
