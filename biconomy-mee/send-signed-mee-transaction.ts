import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import { http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createMeeClient, DEFAULT_STAGING_PATHFINDER_URL, toMultichainNexusAccount } from "@biconomy/abstractjs";

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

  const quote = await meeClient.getQuote({
    instructions: [{
      calls: [{
        to: "0x6474B3178cFA83A628c235515E8613E6eA93697e",
        value: parseEther("0.06"),
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
