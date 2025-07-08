import { join } from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import * as EVM_CHAINS from 'viem/chains';
import { Chain, Client, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { BicoBundlerClient, createBicoBundlerClient, createBicoPaymasterClient, createNexusClient, NexusClient, toNexusAccount } from '@biconomy/sdk';
import { sendTransaction } from '@biconomy/sdk/dist/_types/clients/decorators/smartAccount/sendTransaction';

const keysPath = join(process.cwd(), 'account-secrets.json');
const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.polygon)) as Chain;
const bundlerUrl = `https://bundler.biconomy.io/api/v2/${chain.id}/${keysData['bundler']['mainnet']}`;
const paymasterUrl = `https://paymaster.biconomy.io/api/v1/${chain.id}/${keysData['paymaster']['2']}`;
const web3 = new Web3(new Web3.providers.HttpProvider(chain.rpcUrls.default.http[0]));
const paymaster = createBicoPaymasterClient({
  paymasterUrl: paymasterUrl,
});

// chain.rpcUrls.default.http = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://gateway.tenderly.co/public/sepolia'];

async function createNexusWallet() {
  const privateKey = keysData['wallets']['nexus']['2']['privateKey'];

  const account = privateKeyToAccount(privateKey as any);

  const smartAccount = createBicoBundlerClient({
    account: await toNexusAccount({
      signer: account,
      chain,
      transport: http(chain.rpcUrls.default.http[0], {
        retryCount: 5,
        retryDelay: 2000,
      }),
    }),
    transport: http(bundlerUrl),
    paymaster,
    pollingInterval: 2000,
  })

  return smartAccount;
}

async function sendWithGasTransaction(smartAccount: BicoBundlerClient) {
  const testHash = await sendTransaction(smartAccount, [{
    
  }])
  
  const receipt = await smartAccount.waitForUserOperationReceipt({ hash: testHash });
  console.log("Test transaction successful:", receipt.success);
}

async function main() {
  const smartAccount = await createNexusWallet();

  await sendWithGasTransaction(smartAccount);
}

main().catch(console.error);