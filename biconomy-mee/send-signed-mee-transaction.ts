import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import { http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createMeeClient, getMEEVersion, MEEVersion, toMultichainNexusAccount } from "@biconomy/abstractjs";

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.polygon)) as EVM_CHAINS.Chain;

async function sendTransaction() { 
  const privateKey = keysData["wallets"]["mee"]["23"]["privateKey"];
  const biconomyApiKey = keysData["biconomy-api-key"];

  const eoa = privateKeyToAccount(privateKey as `0x${string}`);

  const orchestrator = await toMultichainNexusAccount({
    chainConfigurations: [
      {
        chain,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_3_0),
      }
    ],
    signer: eoa,
  });

  const meeClient = await createMeeClient({
    account: orchestrator,
    apiKey: biconomyApiKey,
  });

  const nexusAddress = meeClient.account.addressOn(chain.id);

  console.log('EOA address:', eoa.address);

  console.log("Smart account address:", nexusAddress);

  const quote = await meeClient.getQuote({
    instructions: [{
      calls: [{
        to: "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68",
        value: parseEther("0.0000001"),
      }],
      chainId: chain.id,
    }],
    sponsorship: true,
  });

  console.log('quoteeee', JSON.stringify(quote));

  const signedQuote = await meeClient.signQuote({ quote });

  // sending in solution

  const senderEOA = privateKeyToAccount(generatePrivateKey() as `0x${string}`);

  const senderOrchestrator = await toMultichainNexusAccount({
    chainConfigurations: [
      {
        chain,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_3_0),
      }
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

async function setupNewMeeClient() {
  const privateKey = generatePrivateKey() as `0x${string}`;
  console.log('Generated private key:', privateKey);
  const biconomyApiKey = keysData["biconomy-api-key"];

  const eoa = privateKeyToAccount(privateKey as `0x${string}`);

  const orchestrator = await toMultichainNexusAccount({
    chainConfigurations: [
      {
        chain,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_3_0),
      }
    ],
    signer: eoa,
  });

  const meeClient = await createMeeClient({
    account: orchestrator,
    apiKey: biconomyApiKey,
  });

  const nexusAddress = meeClient.account.addressOn(chain.id);

  console.log('EOA address:', eoa.address);

  console.log("Nexus address:", nexusAddress);
}

async function main() {
  await sendTransaction();
  // await setupNewMeeClient();
}

main().catch(console.error);
