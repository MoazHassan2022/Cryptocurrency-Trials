import Web3, { ContractAbi, Transaction } from "web3";
import fs from "fs";
import path from "path";
import { DeployerMethodClass } from "web3-eth-contract";

const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com"; // Ganache
const web3 = new Web3(rpcUrl);

async function signTransaction(
  deployTx: DeployerMethodClass<ContractAbi>
): Promise<string> {
  const PRIVATE_KEY =
    "0x60a1b09c0662f4efa5bcb62568f9cecb6e98dd46cc5649c716258e574a6c052f";
  const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

  const gas = await deployTx.estimateGas();
  const gasPrice = await web3.eth.getGasPrice();

  const signedTx = await web3.eth.accounts.signTransaction(
    {
      data: deployTx.encodeABI(),
      gas,
      gasPrice,
      from: account.address,
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
    arguments: ["Moaz Token 3", "MZT3"],
  });

  const rawTransaction = await signTransaction(deployTx);

  const receipt = await web3.eth.sendSignedTransaction(rawTransaction);

  console.log("✅ Contract deployed at:", receipt.contractAddress);
}

deployContract().catch(console.error);
