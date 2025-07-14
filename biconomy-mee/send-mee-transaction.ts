import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import { http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createMeeClient, toMultichainNexusAccount } from "@biconomy/abstractjs";

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.polygon)) as EVM_CHAINS.Chain;

async function sendWithGasTransaction() {
  const privateKey = keysData["wallets"]["nexus"]["2"]["privateKey"];

  const eoa = privateKeyToAccount(privateKey as `0x${string}`);

  const orchestrator = await toMultichainNexusAccount({
    chains: [
      chain,
    ],
    transports: [
      http()
    ],
    signer: eoa,
  });

  const meeClient = await createMeeClient({
    account: orchestrator,
    // apiKey: 'your-api-key',
    // url: 'https://mee-node-url'
  });

  const smartAccountAddress = meeClient.account.addressOn(chain.id);

  console.log('EOA address:', eoa.address);

  console.log("Smart account address:", smartAccountAddress);

  const quote = await meeClient.getQuote({
    instructions: [{
      calls: [{
        to: "0x372371535faDD69CA29E136Ab9e54717f787f9Cf",
        value: parseEther("0.00001"),
      }],
      chainId: chain.id,
    }],
    feePayer: smartAccountAddress,
    feeToken: {
      address: "0x0000000000000000000000000000000000000000",
      chainId: chain.id,
    },
  });

  console.log('quoteeee', JSON.stringify(quote));

  const { hash } = await meeClient.executeQuote({ quote });

  console.log("hashhhhh", hash);

  const receipt = await meeClient.waitForSupertransactionReceipt({ hash });
  console.log("Test transaction successful:", JSON.stringify(receipt));
}

async function main() {
  await sendWithGasTransaction();
}

main().catch(console.error);
