import Web3 from "web3";
import fs from "fs";
import path from "path";

// Setup Web3 and your Ganache network
const rpcUrl = "http://127.0.0.1:7545"; // Ganache local RPC URL
const web3 = new Web3(rpcUrl);

const PRIVATE_KEY =
  "0x480dc2e6ab41be896c66fd73995fbfb444b076fa1421c58b628db087182c786a";
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

// Load ABI and Deployed Contract Address
const abi = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "StorageABI.json"), "utf8")
);
const deployedAddress = "0x14fD596E821b07A3273441937642B6E381a8Ffc3";

// Create contract instance
const contract = new web3.eth.Contract(abi, deployedAddress);

async function main() {
  // 1. Call `get()` before setting a value
  const currentValue = await contract.methods.get().call();
  console.log(`🔍 Current value: ${currentValue}`);

  // 2. Send a transaction to `set()` a new value
  const newValue = 42;
  const tx = await contract.methods.set(newValue).send({
    from: account.address,
    gas: "100000",
  });
  console.log(`✅ set(${newValue}) transaction hash: ${tx.transactionHash}`);

  // 3. Call `get()` again to verify the change
  const updatedValue = await contract.methods.get().call();
  console.log(`📈 Updated value: ${updatedValue}`);
}

main().catch(console.error);
