import Web3 from "web3";
import fs from "fs";
import { join } from "path";
import solc from "solc";

// === CONFIG ===
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const WALLETS_JSON = join(process.cwd(), "wallets.json");
const CONTRACTS_PATH = join(process.cwd(), "contracts");

let walletsData: {
  feePayer?: { privateKey: string; address: string };
  user?: { privateKey: string; address: string; contractAddress?: string };
  factory?: { address: string };
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

function compileContract(fileName: string) {
  const contractPath = join(CONTRACTS_PATH, fileName);
  const source = fs.readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: { [fileName]: { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
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

async function deployFactoryContract(): Promise<string> {
  if (walletsData.factory?.address) {
    console.log("Factory already deployed at:", walletsData.factory.address);
    return walletsData.factory.address;
  }

  const { abi, bytecode } = compileContract("Factory.sol");

  // 1️⃣ Load or create fee payer wallet
  const feePayer = loadOrCreateWallet("feePayer");

  // 2️⃣ Load or create user wallet
  const user = loadOrCreateWallet("user");

  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(feePayer.privateKey);
  web3.eth.accounts.wallet.add(feePayerAccount);

  const contract = new web3.eth.Contract(abi);

  const deployTx = contract.deploy({ data: "0x" + bytecode, arguments: [user.address] });

  const gasEstimate = await deployTx.estimateGas();
  const txReceipt = await deployTx.send({ from: feePayer.address, gas: gasEstimate.toString() });

  const factoryAddress = txReceipt.options.address;
  walletsData.factory = { address: factoryAddress };
  saveWallets();

  console.log("Factory deployed at:", factoryAddress);
  return factoryAddress;
}

function predictUserWalletAddress() {
  // 1️⃣ Generate EOA if not exists
  const user = loadOrCreateWallet("user");

  const factoryAddress = walletsData.factory?.address;
  if (!factoryAddress) {
    throw new Error("Factory contract address not found");
  }

  // 2️⃣ Compile UserWallet bytecode
  const { bytecode } = compileContract("UserWallet.sol");

  console.log("UserWallet bytecode:", bytecode);

  // 2️⃣ Encode constructor argument (owner = userEOAAddress)
  const constructorEncoded = web3.eth.abi.encodeParameters(
    ["address"],
    [user.address]
  ).slice(2); // remove 0x

  // 3️⃣ Full init code = bytecode + constructor args
  const initCode = bytecode + constructorEncoded;

  console.log("UserWallet init code:", initCode);

  // 3️⃣ Compute salt from user EOA
  const salt = web3.utils.soliditySha3(user.address);

  console.log("UserWallet salt:", salt);

  // 4️⃣ Compute CREATE2 address for UserWallet
  const predictedAddress = web3.utils.toChecksumAddress(
    "0x" +
      web3.utils
        .keccak256(
          "0x" +
            "ff" + // CREATE2 prefix
            factoryAddress.slice(2) +
            salt.slice(2) +
            web3.utils.keccak256("0x" + initCode).slice(2)
        )
        .slice(-40)
  );

  user.contractAddress = predictedAddress;
  saveWallets();

  console.log("Predicted UserWallet address for this EOA:", predictedAddress);
  return predictedAddress;
}

async function deployUserWalletWithFactory() {
  const user = loadOrCreateWallet("user");

  const factoryAddress = walletsData.factory?.address;
  if (!factoryAddress) {
    throw new Error("Factory contract address not found");
  }

  const feePayer = loadOrCreateWallet("feePayer");

  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(feePayer.privateKey);
  web3.eth.accounts.wallet.add(feePayerAccount);

  const { bytecode } = compileContract("UserWallet.sol");

  console.log("UserWallet bytecode:", bytecode);

  const constructorEncoded = web3.eth.abi.encodeParameters(
    ["address"],
    [user.address]
  ).slice(2); // remove 0x

  const initCode = bytecode + constructorEncoded;

  console.log("UserWallet init code:", initCode);

  const predictedAddress = predictUserWalletAddress();

  console.log("Deploying UserWallet to:", predictedAddress);

  const salt = web3.utils.soliditySha3(user.address);

  console.log("UserWallet salt:", salt);

  // 4️⃣ Prepare Factory contract instance
  const { abi: factoryAbi } = compileContract("Factory.sol");
  const factory = new web3.eth.Contract(factoryAbi, factoryAddress);

  // 5️⃣ Call deploy(salt, initCode) on the factory
  const deployTx = factory.methods.deploy(salt, "0x" + initCode);

  const gasEstimate = await deployTx.estimateGas();
  const receipt = await deployTx.send({ from: feePayer.address, gas: gasEstimate.toString() });

  console.log("UserWallet deployed! Tx hash:", receipt.transactionHash);
  console.log("Deployed at address:", predictedAddress);

  return predictedAddress;
}

// === MAIN SCRIPT ===
async function main() {
  // await deployFactoryContract();
  // predictUserWalletAddress();
  // await deployUserWalletWithFactory();
  await sendSignedFundedTransaction();
}

main().catch(console.error);


async function sendSignedFundedTransaction() {
  // 1️⃣ Load or create fee payer wallet
  const feePayer = loadOrCreateWallet("feePayer");

  // 2️⃣ Load or create user wallet
  const user = loadOrCreateWallet("user");

  // 3️⃣ Compile & deploy user contract wallet
  const { abi, bytecode } = compileContract("UserWallet.sol");
  const feePayerAccount = web3.eth.accounts.privateKeyToAccount(feePayer.privateKey);
  web3.eth.accounts.wallet.add(feePayerAccount);

  let contractAddress = walletsData.user?.contractAddress;
  if (!contractAddress) {
    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ data: "0x" + bytecode, arguments: [user.address] });
    const gasEstimate = await deployTx.estimateGas();
    console.log("gasss", gasEstimate);
    const txReceipt = await deployTx.send({ from: feePayer.address, gas: gasEstimate.toString() });
    console.log("User contract deployed at:", txReceipt.options.address);
    contractAddress = txReceipt.options.address;
    walletsData.user.contractAddress = contractAddress;
    saveWallets();
  }

  console.log('User wallet contract is found at', contractAddress);

  // 4️⃣ Build meta-transaction
  const contract = new web3.eth.Contract(abi, contractAddress);
  const nonce = await contract.methods.nonce().call();

  console.log("Nonce:", nonce);

  const to = "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68";
  const value = web3.utils.toWei("0.00000001", "ether");
  const data = "0x";

  const hash = web3.utils.soliditySha3(
    { t: "address", v: contractAddress },
    { t: "address", v: to },
    { t: "uint256", v: value },
    { t: "bytes", v: data },
    { t: "uint256", v: nonce }
  );

  const signature = web3.eth.accounts.sign(hash, user.privateKey).signature;

  console.log("Signature:", signature);

  // 5️⃣ Send transaction from fee payer
  const tx = contract.methods.execute(to, value, data, signature);

  console.log("Sending transaction from fee payer, tx", tx);
  const gasEstimate = await tx.estimateGas({ from: feePayer.address });

  console.log("Gas estimate:", gasEstimate);
  const receipt = await tx.send({ from: feePayer.address, gas: gasEstimate.toString() });

  console.log("Transaction sent by fee payer, tx hash:", receipt.transactionHash);


  // TODOs:
  // Get secure contract with nonce management
  // Calculate address first (separate function), fill it
  // Send only one tx (deploy and transfer) in this function
}