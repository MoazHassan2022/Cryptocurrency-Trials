import Web3 from "web3";
import fs from "fs";
import path, { join } from "path";
import solc from "solc";

// === CONFIG ===
const RPC_URL = "https://sepolia.base.org";
// const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const WALLETS_JSON = join(process.cwd(), "wallets.json");
const CONTRACTS_PATH = join(process.cwd(), "contracts");

let walletsData: {
  feePayer?: { privateKey: string; address: string };
  user?: { privateKey: string; address: string; contractAddress?: string };
  factory?: { address: string };
  implementation?: { address: string };
} = {};
if (fs.existsSync(WALLETS_JSON)) {
  walletsData = JSON.parse(fs.readFileSync(WALLETS_JSON, "utf8"));
} else {
  walletsData = {};
}

const web3 = new Web3(RPC_URL);

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
  return { abi: contractFile.abi, bytecode: contractFile.evm.bytecode.object };
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

  return { maxFeePerGas, maxPriorityFeePerGas };
}

async function deployUserWalletImplementation(): Promise<string> {
  // TODO: deploy this using create2 by parent factory (to be same address in all networks)
  if (walletsData.implementation?.address) {
    console.log(
      "UserWallet implementation already deployed at:",
      walletsData.implementation.address,
    );
    return walletsData.implementation.address;
  }

  const { abi, bytecode } = compileContract("UserWallet.sol");

  const feePayer = loadOrCreateWallet("feePayer");
  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(
    feePayer.privateKey,
  );
  web3.eth.accounts.wallet.add(feePayerAccount);

  const contract = new web3.eth.Contract(abi);

  const deployTx = contract.deploy({ data: "0x" + bytecode });

  const { maxFeePerGas, maxPriorityFeePerGas } = await getMaxFeePerGasData();

  const gasEstimate = await deployTx.estimateGas();
  const deployed = await deployTx.send({
    from: feePayer.address,
    gas: gasEstimate.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  });

  const implementationAddress = deployed.options.address;

  walletsData.implementation = { address: implementationAddress };
  saveWallets();

  console.log("UserWallet implementation deployed at:", implementationAddress);
  return implementationAddress;
}

async function deployFactoryContract(): Promise<string> {
  if (walletsData.factory?.address) {
    console.log("Factory already deployed at:", walletsData.factory.address);
    return walletsData.factory.address;
  }

  if (!walletsData.implementation?.address) {
    throw new Error("UserWallet implementation not deployed");
  }

  const { abi, bytecode } = compileContract("Factory.sol");

  const feePayer = loadOrCreateWallet("feePayer");
  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(
    feePayer.privateKey,
  );
  web3.eth.accounts.wallet.add(feePayerAccount);

  const contract = new web3.eth.Contract(abi);

  const deployTx = contract.deploy({
    data: "0x" + bytecode,
    arguments: [walletsData.implementation.address],
  });

  const { maxFeePerGas, maxPriorityFeePerGas } = await getMaxFeePerGasData();

  const gasEstimate = await deployTx.estimateGas();
  const deployed = await deployTx.send({
    from: feePayer.address,
    gas: gasEstimate.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  });

  const factoryAddress = deployed.options.address;
  walletsData.factory = { address: factoryAddress };
  saveWallets();

  console.log("Factory deployed at:", factoryAddress);
  return factoryAddress;
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
  // await deployUserWalletImplementation();
  // await deployFactoryContract();
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
  const gasEstimate = await tx.estimateGas({ from: feePayer.address });

  console.log("Gas estimate:", gasEstimate);
  const receipt = await tx.send({
    from: feePayer.address,
    gas: gasEstimate.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
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
    hash,
    signature,
  );

  const { maxFeePerGas, maxPriorityFeePerGas } = await getMaxFeePerGasData();

  const gasEstimate = await deployTx.estimateGas();
  const receipt = await deployTx.send({
    from: feePayer.address,
    gas: gasEstimate.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
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
