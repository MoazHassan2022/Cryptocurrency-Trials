import Web3 from "web3";
import fs from "fs";
import path from "path";

// Setup Web3 and your Ganache network
const rpcUrl = "http://127.0.0.1:7545"; // Ganache local RPC URL
const web3 = new Web3(rpcUrl);

const PRIVATE_KEY =
  "0x507ca04a9d724ed5a25a803818ca8b431d2f4acc1b67b973827a832fa8026d67";
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

// Load ABI and Deployed Contract Address
const abi = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "ERC20TokenABI.json"), "utf8")
);
const deployedAddress = "0xe77db9d56143f1094c7d1e9bc52eaa621c1518cc";

// Create contract instance
const contract = new web3.eth.Contract(abi, deployedAddress);

async function main() {
  const name = await contract.methods.name().call();
  console.log(`Name: ${name}`);

  const symbol = await contract.methods.symbol().call();
  console.log(`Symbol: ${symbol}`);
}

main().catch(console.error);
