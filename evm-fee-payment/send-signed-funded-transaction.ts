import Web3 from "web3";
import fs from "fs";
import path, { join } from "path";
import solc from "solc";

// === CONFIG ===
const RPC_URL = "https://sepolia.base.org";
// const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const WALLETS_JSON = join(process.cwd(), "wallets.json");
const CONTRACTS_PATH = join(process.cwd(), "contracts");

const web3 = new Web3(RPC_URL);

// Fixed salts for multi-chain deterministic addresses
const IMPLEMENTATION_SALT = web3.utils.keccak256("USER_WALLET_IMPLEMENTATION_CONTRACT_V1");
const FACTORY_SALT = web3.utils.keccak256("FACTORY_CONTRACT_V1");
const UNIVERSAL_CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

let walletsData: {
  feePayer?: { privateKey: string; address: string };
  implementation?: { address: string };
  factory?: { address: string };
  user?: { privateKey: string; address: string; contractAddress?: string };
} = {};
if (fs.existsSync(WALLETS_JSON)) {
  walletsData = JSON.parse(fs.readFileSync(WALLETS_JSON, "utf8"));
} else {
  walletsData = {};
}

function generateWallet() {
  const account = web3.eth.accounts.create();
  return { privateKey: account.privateKey, address: account.address };
}

function saveWallets() {
  fs.writeFileSync(WALLETS_JSON, JSON.stringify(walletsData, null, 2));
}

function findImports(importPath: string) {
  try {
    // If it's from node_modules (e.g. @openzeppelin)
    if (importPath.startsWith("@")) {
      const fullPath = path.resolve("node_modules", importPath);
      return { contents: fs.readFileSync(fullPath, "utf8") };
    }

    // Otherwise resolve locally
    const fullPath = path.resolve(importPath);
    return { contents: fs.readFileSync(fullPath, "utf8") };
  } catch (error) {
    return { error: "File not found: " + importPath };
  }
}

function compileContract(fileName: string) {
  try {
    const contractPath = join(CONTRACTS_PATH, fileName);
    const source = fs.readFileSync(contractPath, "utf8");
    const input = {
      language: "Solidity",
      sources: { [fileName]: { content: source } },
      settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
    };
    const output = JSON.parse(
      solc.compile(JSON.stringify(input), { import: findImports }),
    );
    const contractFile =
      output.contracts[fileName][Object.keys(output.contracts[fileName])[0]];
    return {
      abi: contractFile.abi,
      bytecode: contractFile.evm.bytecode.object,
    };
  } catch (e) {
    throw new Error(`Error compiling contract: ${e}`);
  }
}

function loadOrCreateWallet(keyName: string) {
  if (!walletsData[keyName]) {
    walletsData[keyName] = generateWallet();
    console.log(`Created ${keyName} wallet:`, walletsData[keyName].address);
    saveWallets();
  }
  return walletsData[keyName];
}

async function getMaxFeePerGasData() {
  // Fetch current EIP-1559 fee data from the network
  const block = await web3.eth.getBlock("pending");
  const baseFee = BigInt(block.baseFeePerGas || 0);

  // Set a tiny priority fee for L2s (e.g., 0.001 Gwei)
  const maxPriorityFeePerGas = web3.utils.toWei("0.001", "gwei");

  // Calculate Max Fee (Base Fee * 1.5 + Priority Fee to ensure inclusion)
  const maxFeePerGas =
    (baseFee * BigInt(150)) / BigInt(100) + BigInt(maxPriorityFeePerGas);

  return { maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas };
}

function predictUniversalAddress(saltHex: string, initCodeHex: string) {
  const initCodeHash = web3.utils.keccak256(initCodeHex);
  return web3.utils.toChecksumAddress(
    "0x" +
      web3.utils
        .keccak256(
          "0xff" +
            UNIVERSAL_CREATE2_FACTORY.slice(2) +
            saltHex.slice(2) +
            initCodeHash.slice(2),
        )
        .slice(-40),
  );
}

function predictCoreAddresses() {
  const { bytecode: implementationBytecode } =
    compileContract("UserWallet.sol");
  const { bytecode: factoryBytecode } = compileContract("Factory.sol");

  // Predict Implementation Address
  const predictedUserWalletImplementationAddress = predictUniversalAddress(
    IMPLEMENTATION_SALT,
    "0x" + implementationBytecode,
  );

  // Predict Factory Address (Need to append constructor args to bytecode)
  const encodedArgs = web3.eth.abi
    .encodeParameters(["address"], [predictedUserWalletImplementationAddress])
    .slice(2);
  const factoryInitCode = "0x" + factoryBytecode + encodedArgs;

  const predictedFactoryAddress = predictUniversalAddress(
    FACTORY_SALT,
    factoryInitCode,
  );

  console.log(
    "Predicted Implementation:",
    predictedUserWalletImplementationAddress,
  );
  console.log("Predicted Factory:", predictedFactoryAddress);

  walletsData.implementation = {
    address: predictedUserWalletImplementationAddress,
  };
  walletsData.factory = { address: predictedFactoryAddress };
  saveWallets();

  return {
    predictedUserWalletImplementationAddress,
    predictedFactoryAddress,
    implementationInitCode: "0x" + implementationBytecode,
    factoryInitCode,
  };
}

// Generic deployer for all networks that uses CREATE2
async function deployUniversal(salt: string, bytecode: string, label: string) {
    const feePayer = walletsData.feePayer;
    web3.eth.accounts.wallet.add(web3.eth.accounts.privateKeyToAccount(feePayer.privateKey));
    
    // The Arachnid Factory takes [SALT (32 bytes)][BYTECODE]
    const data = salt + bytecode.replace("0x", "");
    const { maxFeePerGas, maxPriorityFeePerGas } = await getMaxFeePerGasData();

    console.log(`Deploying ${label}...`);
    const gasEstimate = await web3.eth.estimateGas({ from: feePayer.address, to: UNIVERSAL_CREATE2_FACTORY, data });
    
    await web3.eth.sendTransaction({
        from: feePayer.address,
        to: UNIVERSAL_CREATE2_FACTORY,
        data: data,
        gas: gasEstimate.toString(),
        maxFeePerGas,
        maxPriorityFeePerGas,
    });
    console.log(`${label} deployed successfully!`);
}

async function deployCoreInfrastructure() {
  const feePayer = loadOrCreateWallet("feePayer");
  web3.eth.accounts.wallet.add(
    web3.eth.accounts.privateKeyToAccount(feePayer.privateKey),
  );

  const { implementationInitCode, factoryInitCode } = predictCoreAddresses();

  // Deploy Implementation if not deployed
  const implementationCode = await web3.eth.getCode(walletsData.implementation.address);
  if (implementationCode === "0x") {
    await deployUniversal(IMPLEMENTATION_SALT, implementationInitCode, "Implementation");
    console.log("Implementation deployed!");
  }

  // Deploy Factory if not deployed
  const factoryCode = await web3.eth.getCode(walletsData.factory?.address);
  if (factoryCode === "0x") {
    await deployUniversal(FACTORY_SALT, factoryInitCode, "Factory");
    console.log("Factory deployed!");
  }
}

function predictUserWalletAddress() {
  const user = loadOrCreateWallet("user");

  const factoryAddress = walletsData.factory?.address;
  if (!factoryAddress) {
    throw new Error("Factory contract address not found");
  }

  const implementationAddress = walletsData.implementation?.address;
  if (!implementationAddress) {
    throw new Error("UserWallet implementation not deployed");
  }

  // 1️⃣ Salt (must match factory)
  const salt = web3.utils.soliditySha3(user.address)!;

  console.log("Salt:", salt);
  console.log("Implementation:", implementationAddress);

  // 2️⃣ Minimal proxy creation bytecode (EIP-1167)
  const minimalProxyInitCode =
    "0x3d602d80600a3d3981f3" + // creation code prefix
    "363d3d373d3d3d363d73" + // runtime prefix
    implementationAddress.toLowerCase().replace("0x", "") +
    "5af43d82803e903d91602b57fd5bf3";

  // 3️⃣ Hash init code
  const initCodeHash = web3.utils.keccak256(minimalProxyInitCode)!;

  // 4️⃣ Compute CREATE2 address
  const predictedAddress = web3.utils.toChecksumAddress(
    "0x" +
      web3.utils
        .keccak256(
          "0xff" +
            factoryAddress.slice(2) +
            salt.slice(2) +
            initCodeHash.slice(2),
        )
        .slice(-40),
  );

  user.contractAddress = predictedAddress;
  saveWallets();

  console.log("Predicted Clone Address:", predictedAddress);

  return predictedAddress;
}

// === MAIN SCRIPT ===
async function main() {
  // predictCoreAddresses();
  // await deployCoreInfrastructure();
  // predictUserWalletAddress();
  await deployOrExecute();
}

main().catch(console.error);

async function executeOnly() {
  const user = loadOrCreateWallet("user");
  const feePayer = loadOrCreateWallet("feePayer");

  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(
    feePayer.privateKey,
  );
  web3.eth.accounts.wallet.add(feePayerAccount);

  const { abi } = compileContract("UserWallet.sol");

  const walletContract = new web3.eth.Contract(abi, user.contractAddress);

  const nonce = await walletContract.methods.nonce().call();

  console.log("Nonce:", nonce);

  const to = "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68";
  const value = web3.utils.toWei("0.00000001", "ether");
  const data = "0x";

  const hash = web3.utils.soliditySha3(
    { t: "address", v: user.contractAddress },
    { t: "address", v: to },
    { t: "uint256", v: value },
    { t: "bytes", v: data },
    { t: "uint256", v: nonce },
  );

  const signature = web3.eth.accounts.sign(hash, user.privateKey).signature;

  console.log("Signature:", signature);

  // 5️⃣ Send transaction from fee payer
  const tx = walletContract.methods.execute(to, value, data, hash, signature);

  const { maxFeePerGas, maxPriorityFeePerGas } = await getMaxFeePerGasData();

  console.log("Sending transaction from fee payer, tx", tx);
  const gasEstimate = await tx.estimateGas();

  console.log("Gas estimate:", gasEstimate);
  const receipt = await tx.send({
    from: feePayer.address,
    gas: gasEstimate.toString(),
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  console.log(
    "Transaction sent by fee payer, tx hash:",
    receipt.transactionHash,
  );
}

async function deployAndExecute() {
  const user = loadOrCreateWallet("user");
  const feePayer = loadOrCreateWallet("feePayer");

  const factoryAddress = walletsData.factory?.address;
  if (!factoryAddress) throw new Error("Factory not deployed");

  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(
    feePayer.privateKey,
  );
  web3.eth.accounts.wallet.add(feePayerAccount);

  const predictedAddress = predictUserWalletAddress();

  console.log("Deploying UserWallet to:", predictedAddress);

  const salt = web3.utils.soliditySha3(user.address);

  console.log("UserWallet salt:", salt);

  const { abi: factoryAbi } = compileContract("Factory.sol");
  const factory = new web3.eth.Contract(factoryAbi, factoryAddress);

  const nonce = 0;
  const to = "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68";
  const value = web3.utils.toWei("0.00000001", "ether");
  const data = "0x";

  const hash = web3.utils.soliditySha3(
    { t: "address", v: predictedAddress },
    { t: "address", v: to },
    { t: "uint256", v: value },
    { t: "bytes", v: data },
    { t: "uint256", v: nonce },
  );

  const signature = web3.eth.accounts.sign(hash!, user.privateKey).signature;

  console.log("Signature:", signature);

  const deployTx = factory.methods.deployAndExecute(
    salt,
    user.address,
    to,
    value,
    data,
    signature,
  );

  const { maxFeePerGas, maxPriorityFeePerGas } = await getMaxFeePerGasData();

  const gasEstimate = await deployTx.estimateGas();
  const receipt = await deployTx.send({
    from: feePayer.address,
    gas: gasEstimate.toString(),
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  console.log(
    "Transaction sent by fee payer, tx hash:",
    receipt.transactionHash,
  );
}

async function deployOrExecute() {
  const user = loadOrCreateWallet("user");
  const feePayer = loadOrCreateWallet("feePayer");

  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(
    feePayer.privateKey,
  );
  web3.eth.accounts.wallet.add(feePayerAccount);

  const code = await web3.eth.getCode(user.contractAddress);
  const isDeployed = code !== "0x";

  console.log("Is deployed:", isDeployed);

  if (isDeployed) {
    executeOnly();
  } else {
    deployAndExecute();
  }
}

/*
TODOs:
* Factory and User Implementation constant addresses in all networks
* Nonce management
* Security issues solving
* Transaction expiration??
* In our app, reduce fees of tokenization and sent transactions (created a task)
*/
