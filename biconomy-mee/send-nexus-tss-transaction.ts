import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import { http, parseEther } from "viem";
import { createBundler, UserOperationStruct } from "@biconomy/account";
import {
  createBicoPaymasterClient,
  createSmartAccountClient,
  NexusClient,
  toNexusAccount,
} from "@biconomy/abstractjs";
import axios from "axios";
import { CustomSignedUserOperation, CustomUserOperation } from "types";
import type { Account, Address, Hex, LocalAccount } from "viem";
import {
  keccak256,
  hashMessage,
  hashTypedData,
  serializeTransaction,
} from "viem";
import { recoverAddress, Signature } from "ethers";

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const chain = JSON.parse(
  JSON.stringify(EVM_CHAINS.baseSepolia)
) as EVM_CHAINS.Chain;

const orchestratorUrl = "http://localhost:8080";
const v3BundlerUrl = `https://bundler.biconomy.io/api/v3/${chain.id}/${keysData["networks"]["23"]["bundler"]}`;
const v2PaymasterUrl = `https://paymaster.biconomy.io/api/v2/${chain.id}/${keysData["networks"]["23"]["paymaster"]}`;

interface TSSWallet {
  address: Address;
  pubkeyHex: Hex;
  keyId: string;
  participants?: string[];
  threshold?: number;
}

export function signDigestWithNoParity(
  digest: string,
  rHex: string,
  sHex: string,
  fromAddr: string
): Hex {
  const sig0 = Signature.from({
    r: "0x" + rHex.replace(/^0x/, ""),
    s: "0x" + sHex.replace(/^0x/, ""),
    yParity: 0,
  });
  const addr0 = recoverAddress(digest, sig0);
  const yParity: 0 | 1 = addr0.toLowerCase() === fromAddr.toLowerCase() ? 0 : 1;

  const signature = Signature.from({
    r: "0x" + rHex.replace(/^0x/, ""),
    s: "0x" + sHex.replace(/^0x/, ""),
    yParity,
  });

  return signature.serialized as Hex;
}

export async function createTssWallet(): Promise<TSSWallet> {
  // ask orchestrator to TSS-keygen
  const { data } = await axios.post(`${orchestratorUrl}/wallet/new`, {
    parties: ["A", "B", "C"],
    threshold: 2,
  });

  const { keyId, pubkeyHex, address } = data as {
    keyId: string;
    pubkeyHex: `0x${string}`;
    address: `0x${string}`;
  };

  console.log("Created TSS wallet:", { keyId, pubkeyHex, address });

  return { keyId, pubkeyHex, address };
}

export function makeTSSAccount(wallet: TSSWallet): Account {
  const participants = wallet.participants ?? ["A", "B"];
  const threshold = wallet.threshold ?? participants.length;

  async function signDigest(digest: Hex): Promise<Hex> {
    const digestHex = digest.startsWith("0x") ? digest.slice(2) : digest;
    const { data } = await axios.post(
      `${orchestratorUrl}/ecdsa/sign-generic`,
      {
        keyId: wallet.keyId,
        participants,
        threshold,
        digestHex,
      },
      { timeout: 20000 }
    );

    const r = data.r as Hex;
    const s = data.s as Hex;

    return signDigestWithNoParity(digest, r, s, wallet.address);
  }

  return {
    type: "local",
    source: "tss",
    address: wallet.address as Address,
    publicKey: wallet.pubkeyHex, // optional but helpful

    // EIP-191
    async signMessage({ message }) {
      const digest = hashMessage(message);
      return signDigest(digest);
    },

    // EIP-712
    async signTypedData(typed) {
      const digest = hashTypedData(typed as any);
      return signDigest(digest);
    },

    // (Optional) Legacy/1559 tx signing; AA rarely needs this
    async signTransaction(tx, { serializer = serializeTransaction } = {}) {
      const unsignedSerialized = serializer(tx);
      const digest = keccak256(unsignedSerialized);
      return signDigest(digest);
    },
  };
}

async function getNexusClient(wallet: TSSWallet): Promise<NexusClient> {
  const signer = makeTSSAccount({
    ...wallet,
    participants: ["A", "B"],
    threshold: 2,
  });

  const nexusAccount = await toNexusAccount({
    signer: signer as LocalAccount,
    chain,
    transport: http(chain.rpcUrls.default.http[0], {
      retryCount: 5,
      retryDelay: 2000,
    }),
    pollingInterval: 2000,
  });

  const nexusClient = createSmartAccountClient({
    account: nexusAccount,
    transport: http(v3BundlerUrl),
    paymaster: createBicoPaymasterClient({
      transport: http(v2PaymasterUrl),
    }),
  });

  console.log(
    "nexus wallet signer address",
    nexusClient.account.signer.address
  );
  console.log("nexus wallet address", nexusClient.account.address);

  return nexusClient;
}

async function sendNexusTSSTransaction(nexusAccount: NexusClient) {
  console.log("Testing migrated account...");

  const userOperation: CustomUserOperation =
    await nexusAccount.prepareUserOperation({
      calls: [
        {
          to: "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68",
          value: parseEther("0.000001"),
          // data: "0x",
        },
      ],
    } as any);

  const signature = await nexusAccount.account.signUserOperation(
    userOperation as CustomSignedUserOperation
  );

  (userOperation as CustomSignedUserOperation).signature = signature;
  console.log("userOperationnnn", userOperation);

  const bundler = await createBundler({
    chainId: chain.id,
    bundlerUrl: v3BundlerUrl,
    entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  });

  console.log("v3BundlerUrl", v3BundlerUrl);

  const keys = ["paymasterPostOpGasLimit", "paymasterVerificationGasLimit"];

  for (const key of keys) {
    if (userOperation[key] && userOperation[key] !== "0x") {
      userOperation[key] = `0x${BigInt(userOperation[key]).toString(
        16
      )}` as `0x${string}`;
    }
  }

  const userOpResponse = await bundler.sendUserOp(
    userOperation as UserOperationStruct
  );

  console.log("userOpResponse", userOpResponse);

  const txHashStatus = await userOpResponse.waitForTxHash();

  console.log("txHashStatus", txHashStatus);
}

async function main() {
  // await createTssWallet();
  const nexusAccount = await getNexusClient({
    keyId: "key-1759051838519",
    pubkeyHex:
      "0x0406e9f2d0dc48ab2c3ab4c6393b5419921c662bef5db29d46ec75fa884cc3045056d869682f63c95cf8aa497faa449ad187f922cb2275c6e0a5de7db58217aa1f",
    address: "0x5dAfE666f73e9c87d77bfd78C34471694a9F86AF",
    participants: ["A", "B"],
    threshold: 2,
  });
  await sendNexusTSSTransaction(nexusAccount);
}

main().catch(console.error);
