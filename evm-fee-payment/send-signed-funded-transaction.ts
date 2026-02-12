import Web3 from "web3";
import fs from "fs";
import { join } from "path";
import solc from "solc";

// === CONFIG ===
const RPC_URL = ""; // Fill your RPC URL
const WALLETS_JSON = join(process.cwd(), "wallets.json");

let keysData: { wallets: { [key: string]: { privateKey?: string; address: string } } };
if (fs.existsSync(WALLETS_JSON)) {
  keysData = JSON.parse(fs.readFileSync(WALLETS_JSON, "utf8"));
} else {
  keysData = { wallets: {} };
}

const web3 = new Web3(RPC_URL);

function generateWallet() {
  const account = web3.eth.accounts.create();
  return { privateKey: account.privateKey, address: account.address };
}

function saveKeys() {
  fs.writeFileSync(WALLETS_JSON, JSON.stringify(keysData, null, 2));
}

function compileContract() {
  const contractPath = join(process.cwd(), "contracts", "UserWallet.sol");
  const source = fs.readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "UserWallet.sol": { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contractFile = output.contracts["UserWallet.sol"]["UserWallet"];
  return { abi: contractFile.abi, bytecode: contractFile.evm.bytecode.object };
}

async function sendSignedFundedTransaction() {
  // 1️⃣ Load or create fee payer wallet
  if (!keysData.wallets.feePayer) {
    keysData.wallets.feePayer = generateWallet();
    console.log("Created fee payer wallet:", keysData.wallets.feePayer.address);
    saveKeys();
  }
  const feePayer = keysData.wallets.feePayer;

  // 2️⃣ Load or create user wallet
  if (!keysData.wallets.user) {
    keysData.wallets.user = generateWallet();
    console.log("Created user wallet:", keysData.wallets.user.address);
    saveKeys();
  }
  // const user = keysData.wallets.user;

  // // 3️⃣ Compile & deploy user contract wallet
  // const { abi, bytecode } = compileContract();
  // const feePayerAccount = web3.eth.accounts.privateKeyToAccount(feePayer.privateKey);
  // web3.eth.accounts.wallet.add(feePayerAccount);

  // let contractAddress = keysData.wallets.userContract?.address;
  // if (!contractAddress) {
  //   const contract = new web3.eth.Contract(abi);
  //   const deployTx = contract.deploy({ data: "0x" + bytecode, arguments: [user.address] });
  //   const gas = await deployTx.estimateGas();
  //   const txReceipt = await deployTx.send({ from: feePayer.address, gas });
  //   console.log("User contract deployed at:", txReceipt.options.address);
  //   contractAddress = txReceipt.options.address;
  //   keysData.wallets.userContract = { address: contractAddress };
  //   saveKeys();
  // }

  // // 4️⃣ Build meta-transaction
  // const contract = new web3.eth.Contract(abi, contractAddress);
  // const nonce = await contract.methods.nonce().call();

  // const to = user.address; // Example: send to yourself
  // const value = web3.utils.toWei("0.001", "ether");
  // const data = "0x";

  // const hash = web3.utils.soliditySha3(
  //   { t: "address", v: contractAddress },
  //   { t: "address", v: to },
  //   { t: "uint256", v: value },
  //   { t: "bytes", v: data },
  //   { t: "uint256", v: nonce }
  // );

  // const signature = web3.eth.accounts.sign(hash!, user.privateKey).signature;

  // // 5️⃣ Send transaction from fee payer
  // const tx = contract.methods.execute(to, value, data, signature);
  // const gasEstimate = await tx.estimateGas({ from: feePayer.address, value: 0 });
  // const receipt = await tx.send({ from: feePayer.address, gas: gasEstimate });
  // console.log("Transaction sent by fee payer, tx hash:", receipt.transactionHash);
}

// === MAIN SCRIPT ===
async function main() {
  await sendSignedFundedTransaction();
}

main().catch(console.error);
