import Web3, { Transaction } from "web3";
import fs from "fs";
import path from "path";

const rpcUrl = "http://127.0.0.1:7545"; // Ganache
const web3 = new Web3(rpcUrl);

async function deployContract() {
  const abi = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "ERC20TokenABI.json"), "utf8")
  );
  const bytecode = fs
    .readFileSync(path.resolve(__dirname, "ERC20TokenBytecode.txt"), "utf8")
    .trim();

  const PRIVATE_KEY =
    "0x60a1b09c0662f4efa5bcb62568f9cecb6e98dd46cc5649c716258e574a6c052f";
  const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
  web3.eth.accounts.wallet.add(account);

  const contract = new web3.eth.Contract(abi);

  const deployTx = contract.deploy({
    data: "0x" + bytecode,
    arguments: ["Moaz Token 2", "MZT2"],
  });

  const gas = Number(await deployTx.estimateGas());
  const gasPrice = Number(await web3.eth.getGasPrice());

  console.log("gas limit", gas);
  console.log("gas", gas);
  console.log("gasPrice", gasPrice);

  const deployedContract = await deployTx.send({
    from: account.address,
    gas: gas.toString(),
    gasPrice: gasPrice.toString(),
  });

  console.log("✅ Contract deployed at:", deployedContract.options.address);
}

deployContract().catch(console.error);
