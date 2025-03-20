import Web3 from "web3";
import fs from "fs";
import path from "path";

// Setup Web3 and your Ganache network
const rpcUrl = "http://127.0.0.1:7545"; // Ganache local RPC URL
const web3 = new Web3(rpcUrl);

const PRIVATE_KEY =
  "";
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

// Load ABI and Deployed Contract Address
const abi = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "ERC20TokenABI.json"), "utf8")
);
const deployedAddress = "0xb196ee2c6f5d36b942d45de073ebecb93878608e";

// Create contract instance
const contract = new web3.eth.Contract(abi, deployedAddress);

async function main() {
  const name = await contract.methods.name().call();
  console.log(`Name: ${name}`);

  const symbol = await contract.methods.symbol().call();
  console.log(`Symbol: ${symbol}`);
}

main().catch(console.error);
