import { join } from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import * as EVM_CHAINS from 'viem/chains';
import { Chain, createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from '@biconomy/account';

const keysPath = join(process.cwd(), 'account-secrets.json');
const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.polygon)) as Chain;
const bundlerUrl = `https://bundler.biconomy.io/api/v2/${chain.id}/${keysData['bundler']['mainnet']}`;
const paymasterUrl = `https://paymaster.biconomy.io/api/v1/${chain.id}/${keysData['paymaster']['2']}`;
const web3 = new Web3(new Web3.providers.HttpProvider(chain.rpcUrls.default.http[0]));

// chain.rpcUrls.default.http = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://gateway.tenderly.co/public/sepolia'];

async function convertPrivateKeyToSmartAccount(privateKey: string) {
    const account = privateKeyToAccount(privateKey as any);

    const client = createWalletClient({
      account,
      chain: chain,
      transport: http(chain.rpcUrls.default.http[0], {
        retryCount: 5,
        retryDelay: 2000,
      }),
      pollingInterval: 2000,
    });

    const smartAccount = await createSmartAccountClient({
      signer: client,
      bundlerUrl: bundlerUrl,
      paymasterUrl: paymasterUrl,
    });

    return smartAccount;
  }

  async function createWallet() {
    const privateKey = generatePrivateKey();

    const smartAccount = await convertPrivateKeyToSmartAccount(privateKey);

    const address = await smartAccount.getAccountAddress();

    const { address: eoaAddress } = web3.eth.accounts.privateKeyToAccount(privateKey);

    return {
      privateKey,
      address,
      eoaAddress,
    };
  }

async function main() {
  const result = await createWallet();

  console.log('resulttt', result);
}

main().catch(console.error);