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

function generateImports(config: any): string {
  let imports = `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.20;

      import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
      import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";`;

  if (config.canBurn) {
    imports += `
      import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";`;
  }
  if (config.canPause) {
    imports += `
      import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";`;
  }

  return imports;
}

function generateInheritance(config: any): string {
  let inheritance = `
      contract ERC20Token is ERC20, Ownable`;
  if (config.canBurn) {
    inheritance += `, ERC20Burnable`;
  }
  if (config.canPause) {
    inheritance += `, ERC20Pausable`;
  }

  inheritance += `{`;

  return inheritance;
}

function generatePrivateMembers(): string {
  return `
      uint8 private _customDecimals;
    `;
}

function generateConstructor(): string {
  let constructor = `
      constructor(string memory name, string memory symbol, address owner, address recipient, uint256 initialSupply, uint8 decimals_) 
      ERC20(name, symbol) 
      Ownable(owner)
      {
          _customDecimals = decimals_;
          _mint(recipient, initialSupply);
      }
    `;

  return constructor;
}

function generateDecimalsFunction(): string {
  return `
      function decimals() public view override returns (uint8) {
          return _customDecimals;
      }
    `;
}

function generateMintFunction(config: any): string {
  if (!config.canMint)
    return '';
  return `
      function mint(address to, uint256 amount) public onlyOwner {
          _mint(to, amount);
      }
  `;
}

function generatePauseFunctions(config: any): string {
  if (!config.canPause)
    return '';
  return `
      function pause() public onlyOwner {
          _pause();
      }
      function unpause() public onlyOwner {
          _unpause();
      }
      function _update(address fro, address to, uint256 value)
          internal
          override(ERC20, ERC20Pausable)
      {
          super._update(fro, to, value);
      }
  `;
}

function generateSource(config: any): string {
  const imports = generateImports(config);
  const inheritance = generateInheritance(config);
  const privateMembers = generatePrivateMembers();
  const constructor = generateConstructor();
  const decimalsFunction = generateDecimalsFunction();
  const mintFunction = generateMintFunction(config);
  const pauseFunctions = generatePauseFunctions(config);

  const source = `${imports}${inheritance}${privateMembers}${constructor}${decimalsFunction}${mintFunction}${pauseFunctions}}`;

  return source;
}

/*const source = generateSource({
  canBurn: true,
  canPause: true,
  canMint: true,
});*/

const source = fs.readFileSync(path.resolve(__dirname, 'contracts', 'erc20-token.sol'), 'utf8');

console.log('sourceee', source);

const input = {
  language: 'Solidity',
  sources: {
    'erc20-token': {
      content: source,
    },
  },
  settings: {
    evmVersion: 'paris',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode'],
      },
    },
  },
};

let compiled: any;
try {
  compiled = JSON.parse(
    solc.compile(JSON.stringify(input),{
      import: findImports
    })
  );
} catch (e) {
  console.error("Failed to compile contract:", e);
  process.exit(1);
}

const contract = compiled.contracts["erc20-token"]["ERC20Token"];
fs.writeFileSync("ERC20TokenABI.json", JSON.stringify(contract.abi, null, 2));
fs.writeFileSync("ERC20TokenBytecode.txt", contract.evm.bytecode.object);

console.log("✅ Contract compiled!");
