//@ts-ignore
import solc from "solc";
import * as fs from "fs";
import * as path from "path";

const contractPath = path.resolve(__dirname, "contracts", "storage.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "storage.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
  },
};

const compiled = JSON.parse(solc.compile(JSON.stringify(input)));

const contract = compiled.contracts["storage.sol"]["Storage"];
fs.writeFileSync("StorageABI.json", JSON.stringify(contract.abi, null, 2));
fs.writeFileSync("StorageBytecode.txt", contract.evm.bytecode.object);

console.log("✅ Contract compiled!");
