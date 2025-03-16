import Web3, { Transaction } from "web3";
import fs from "fs";
import path from "path";

const rpcUrl = "http://127.0.0.1:7545"; // Ganache
const web3 = new Web3(rpcUrl);

async function signTransaction(txData: Transaction): Promise<string> {
  const PRIVATE_KEY =
    "0x507ca04a9d724ed5a25a803818ca8b431d2f4acc1b67b973827a832fa8026d67";
  const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

  const nonce = await web3.eth.getTransactionCount(account.address, "pending");

  txData.from = account.address;

  const signedTx = await web3.eth.accounts.signTransaction(
    {
      ...txData,
      from: account.address,
      nonce,
    },
    PRIVATE_KEY
  );

  if (!signedTx.rawTransaction) {
    throw new Error("Failed to sign transaction");
  }

  return signedTx.rawTransaction;
}

async function deployContract() {
  const abi = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "ERC20TokenABI.json"), "utf8")
  );
  const bytecode = fs
    .readFileSync(path.resolve(__dirname, "ERC20TokenBytecode.txt"), "utf8")
    .trim();

  const contract = new web3.eth.Contract(abi);
  const deployTx = contract.deploy({
    data: "0x" + bytecode,
    arguments: ["Moaz Token", "MZT"],
  });

  const gas = await deployTx.estimateGas();

  const encodedABI = deployTx.encodeABI();

  const gasPrice = await web3.eth.getGasPrice();

  const txData: Transaction = {
    data: encodedABI,
    gas,
    gasPrice,
  };

  const signedTx = await signTransaction(txData);

  const receipt = await web3.eth.sendSignedTransaction(signedTx);

  console.log("✅ Contract deployed at:", receipt.contractAddress);
}

deployContract().catch(console.error);
