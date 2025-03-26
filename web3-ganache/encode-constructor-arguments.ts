import Web3 from "web3";

const rpcUrl = /*"http://localhost:7545"*/ "https://ethereum-sepolia-rpc.publicnode.com"; // Ganache
const web3 = new Web3(rpcUrl);

const PRIVATE_KEY =
    "";
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

const initialSupply = "150000000000000000000000";

const encodedConstructorArgs = web3.eth.abi.encodeParameters(
    ["string", "string", "address", "address", "uint256", "uint8"],
    ["Moaz Token 11", "MZT11", account.address, account.address, initialSupply, 20]
);

console.log("Encoded constructor arguments:", encodedConstructorArgs);

