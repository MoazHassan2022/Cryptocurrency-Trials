import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import { http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createBicoPaymasterClient, createNexusClient } from "@biconomy/sdk";

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.polygon)) as EVM_CHAINS.Chain;
// const bundlerUrl = `https://bundler.biconomy.io/api/v2/${chain.id}/${keysData["bundler"]["mainnet"]}`;
const bundlerUrl = 'https://bundler.biconomy.io/api/v3/137/bundler_3ZkGmwJ9ypz3Fc8QVMRPARvQ';
const paymasterUrl = `https://paymaster.biconomy.io/api/v2/${chain.id}/${keysData["paymaster"]["2"]}`;
const paymaster = createBicoPaymasterClient({
  paymasterUrl: paymasterUrl,
});

// chain.rpcUrls.default.http = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://gateway.tenderly.co/public/sepolia'];

async function sendWithGasTransaction() {
  const privateKey = keysData["wallets"]["nexus"]["2"]["privateKey"];

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const smartAccount = await createNexusClient({
    signer: account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
    // transport: http(chain.rpcUrls.default.http[0], {
    //   retryCount: 5,
    //   retryDelay: 2000,
    // }),
    bundlerTransport: http(bundlerUrl),
    //paymaster,
    // pollingInterval: 2000,
  });

  const smartAccountAddress = smartAccount.account.address;
  console.log("Smart account address:", smartAccountAddress);

  const hash = await smartAccount.sendTransaction({
    calls: [
      {
        to: "0x372371535faDD69CA29E136Ab9e54717f787f9Cf",
        value: parseEther("0.00001"),
      },
    ],
    maxFeePerGas: parseEther("100", "gwei"),
    maxPriorityFeePerGas: 18000000000,
    gasLimit: BigInt(1000000),
  } as any);

  console.log("hashhhhh", hash);

  const receipt = await smartAccount.waitForTransactionReceipt({ hash });
  console.log("Test transaction successful:", receipt);
}

async function main() {
  await sendWithGasTransaction();
}

main().catch(console.error);
