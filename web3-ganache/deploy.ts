import Web3 from "web3";
import fs from "fs";
import path from "path";

const rpcUrl = "http://127.0.0.1:7545"; // Ganache
const web3 = new Web3(rpcUrl);

const PRIVATE_KEY =
  "0x480dc2e6ab41be896c66fd73995fbfb444b076fa1421c58b628db087182c786a";

const abi = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "StorageABI.json"), "utf8")
);
const bytecode = fs.readFileSync(
  path.resolve(__dirname, "StorageBytecode.txt"),
  "utf8"
);

(async () => {
  const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
  web3.eth.accounts.wallet.add(account);

  const contract = new web3.eth.Contract(abi);
  const deployTx = contract.deploy({
    data: "0x" + bytecode,
    arguments: [50],
  });

  const gas = await deployTx.estimateGas();

  const deployedContract = await deployTx.send({
    from: account.address,
    gas: gas.toString(),
  });

  console.log("✅ Contract deployed at:", deployedContract.options.address);
})();
