import Web3, { ContractAbi } from "web3";
import fs from "fs";
import path from "path";
import { DeployerMethodClass } from "web3-eth-contract";

const rpcUrl = /*"http://localhost:7545"*/ "https://ethereum-sepolia-rpc.publicnode.com"; // Ganache
const web3 = new Web3(rpcUrl);
const PRIVATE_KEY =
    "";
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

async function signTransaction(
  deployTx: DeployerMethodClass<ContractAbi>
): Promise<string> {
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

  const initialSupply = "150000000000000000000000";

  const deployTx = contract.deploy({
    data: "0x" + bytecode,
    arguments: ["Moaz Token 11", "MZT11", account.address, account.address, initialSupply, 20],
  });

  const rawTransaction = await signTransaction(deployTx);

  const receipt = await web3.eth.sendSignedTransaction(rawTransaction);

  console.log("✅ Contract deployed at:", receipt.contractAddress);
}

deployContract().catch(console.error);
