import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import { encodeFunctionData, http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createMeeClient, toMultichainNexusAccount } from "@biconomy/abstractjs";
const abi = require('erc-20-abi');

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.polygon)) as EVM_CHAINS.Chain;

async function sendTransaction() {
  const privateKey = keysData["wallets"]["nexus"]["2"]["privateKey"];
  const biconomyApiKey = keysData["biconomy-api-key"];

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
    apiKey: biconomyApiKey,
  });

  const smartAccountAddress = meeClient.account.addressOn(chain.id);

  console.log('EOA address:', eoa.address);

  console.log("Smart account address:", smartAccountAddress);

  const data = encodeFunctionData({
    abi: abi,
    functionName: 'transfer',
    args: ["0x372371535faDD69CA29E136Ab9e54717f787f9Cf", 100000],
  });

  const quote = await meeClient.getQuote({
    instructions: [{
      calls: [{
        to: "0x31755970c67BB8316816b8AdcB58d792ac262043",
        data,
      }],
      chainId: chain.id,
    }],
    sponsorship: true,
  });

  console.log('quoteeee', JSON.stringify(quote));

  const signedQuote = await meeClient.signQuote({ quote });

  const senderEOA = privateKeyToAccount(generatePrivateKey() as `0x${string}`);

  const senderOrchestrator = await toMultichainNexusAccount({
    chains: [
      chain,
    ],
    transports: [
      http()
    ],
    signer: senderEOA,
  });

  const senderMeeClient = await createMeeClient({
    account: senderOrchestrator,
    apiKey: biconomyApiKey,
  });

  console.log('Sender EOA address', senderMeeClient.account.addressOn(chain.id));

  const { hash } = await senderMeeClient.executeSignedQuote({ signedQuote });

  console.log("hashhhhh", hash);

  const receipt = await senderMeeClient.waitForSupertransactionReceipt({ hash });
  console.log("Test transaction successful:", receipt);
}

async function main() {
  await sendTransaction();
}

main().catch(console.error);
