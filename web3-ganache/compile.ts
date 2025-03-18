//@ts-ignore
import solc from "solc";
import * as fs from "fs";
import * as path from "path";

function findImports(importPath: string) {
  try {
    const fullPath = path.resolve("node_modules", importPath);
    const contents = fs.readFileSync(fullPath, "utf8");
    return { contents };
  } catch (e) {
    return { error: `Import not found: ${importPath}` };
  }
}

const source = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;

    import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

    contract ERC20Token is ERC20 {
        constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    }
`;

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
