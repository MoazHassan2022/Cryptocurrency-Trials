import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import { http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createBicoPaymasterClient, createNexusClient } from "@biconomy/sdk";

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.sepolia)) as EVM_CHAINS.Chain;
// const bundlerUrl = `https://bundler.biconomy.io/api/v2/${chain.id}/${keysData["bundler"]["mainnet"]}`;
const bundlerUrl = `https://bundler.biconomy.io/api/v3/${chain.id}/${keysData["networks"]["14"]["bundler"]}`;
// const paymasterUrl = `https://paymaster.biconomy.io/api/v2/${chain.id}/${keysData["networks"]["14"]["paymaster"]}`;
// const paymaster = createBicoPaymasterClient({
//   paymasterUrl: paymasterUrl,
// });

chain.rpcUrls.default.http = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://gateway.tenderly.co/public/sepolia'];

async function sendWithGasTransaction() {
  const privateKey = keysData["wallets"]["nexus"]["14"]["privateKey"];

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  console.log('before creation', {
    signer: account,
    chain,
    transport: chain.rpcUrls.default.http[0],
    bundlerTransport: bundlerUrl,
  });

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
        to: "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68",
        value: parseEther("0"),
      },
    ],
    // maxFeePerGas: parseEther("100", "gwei"),
    // maxPriorityFeePerGas: 18000000000,
    // gasLimit: BigInt(1000000),
  } as any);

  console.log("hashhhhh", hash);

  const receipt = await smartAccount.waitForTransactionReceipt({ hash });
  console.log("Test transaction successful:", receipt);
}

async function main() {
  await sendWithGasTransaction();
}

main().catch(console.error);
