//@ts-ignore
import solc from "solc";
import * as fs from "fs";
import * as path from "path";

const contractPath = path.resolve(__dirname, "contracts", "erc20-token.sol");
const source = fs.readFileSync(contractPath, "utf8");

function findImports(importPath: string) {
  try {
    const fullPath = path.resolve("node_modules", importPath);
    const contents = fs.readFileSync(fullPath, "utf8");
    return { contents };
  } catch (e) {
    return { error: `Import not found: ${importPath}` };
  }
}

const input = {
  language: "Solidity",
  sources: {
    "erc20-token.sol": {
      content: source,
    },
  },
  settings: {
    evmVersion: "paris",
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
  },
};

let compiled: any;
try {
  compiled = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports })
  );
} catch (e) {
  console.error("Failed to compile contract:", e);
  process.exit(1);
}

const contract = compiled.contracts["erc20-token.sol"]["ERC20Token"];
fs.writeFileSync("ERC20TokenABI.json", JSON.stringify(contract.abi, null, 2));
fs.writeFileSync("ERC20TokenBytecode.txt", contract.evm.bytecode.object);

console.log("✅ Contract compiled!");
