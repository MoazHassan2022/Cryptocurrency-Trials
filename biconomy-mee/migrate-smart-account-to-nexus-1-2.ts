import { join } from "path";
import * as fs from "fs";
import * as EVM_CHAINS from "viem/chains";
import {
  ContractFunctionExecutionError,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  parseEther,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  BiconomySmartAccountV2,
  createBundler,
  createSmartAccountClient as createV2Client,
  PaymasterMode,
  UserOperationStruct,
} from "@biconomy/account";
import {
  createBicoPaymasterClient,
  createMeeClient,
  createSmartAccountClient,
  NexusAccount,
  toMultichainNexusAccount,
  toNexusAccount,
} from "@biconomy/abstractjs";
import axios from "axios";
import { CustomSignedUserOperation, CustomUserOperation } from "types";

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const chain = JSON.parse(JSON.stringify(EVM_CHAINS.baseSepolia)) as EVM_CHAINS.Chain;

const v2BundlerUrl = `https://bundler.biconomy.io/api/v2/${chain.id}/${keysData["networks"]["19"]["v2Bundler"]}`;
const v3BundlerUrl = `https://bundler.biconomy.io/api/v3/${chain.id}/${keysData["networks"]["19"]["bundler"]}`;
const v1PaymasterUrl = `https://paymaster.biconomy.io/api/v1/${chain.id}/${keysData["networks"]["19"]["v1Paymaster"]}`;
const v2PaymasterUrl = `https://paymaster.biconomy.io/api/v2/${chain.id}/${keysData["networks"]["19"]["paymaster"]}`;

const nexusImplementationAddress = "0x0000000025a29E0598c88955fd00E256691A089c";
const nexusBootstrapAddress = "0x000000001aafD7ED3B8baf9f46cD592690A5BBE5";
const biconomyApiKey = keysData["biconomy-api-key"];

async function deployV2Account(v2Account: BiconomySmartAccountV2) {
  const deploymentResponse = await v2Account.sendTransaction([
    {
      to: await v2Account.getAccountAddress(),
      value: "0",
    },
  ], {
    paymasterServiceData: {
      mode: PaymasterMode.SPONSORED, 
    }
  });

  console.log("V2 account deployment response:", deploymentResponse);

  const { transactionHash } = await deploymentResponse.waitForTxHash();
  console.log("V2 account deployment transaction hash:", transactionHash);
}

async function migrateSmartAccountToNexus() {
  const privateKey = keysData["wallets"]["smartAccountV2"]["2-2"]["privateKey"];

  const eoaAccount = privateKeyToAccount(privateKey as `0x${string}`);

  console.log("EOA Address:", eoaAccount.address);

  const client = createWalletClient({
    account: eoaAccount,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  const v2Account = await createV2Client({
    signer: client,
    bundlerUrl: v2BundlerUrl,
    paymasterUrl: v1PaymasterUrl,
  });

  const v2AccountAddress = await v2Account.getAccountAddress();
  console.log("V2 Account Address:", v2AccountAddress);

  const isDeployed = await v2Account.isAccountDeployed();

  console.log("isDeployed", isDeployed);

  if (!isDeployed) {
    console.log("Account not deployed, deploying now...");

    await deployV2Account(v2Account);
  } else {
    console.log("Account already deployed, proceeding with migration");
  }

  console.log("Preparing update implementation to Nexus...");
  const updateImplementationCalldata = encodeFunctionData({
    abi: [
      {
        name: "updateImplementation",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ type: "address", name: "newImplementation" }],
        outputs: [],
      },
    ],
    functionName: "updateImplementation",
    args: [nexusImplementationAddress],
  });

  const updateImplementationTransaction = {
    to: v2AccountAddress,
    data: updateImplementationCalldata,
  };

  console.log("Preparing initialize Nexus account...");
  const ownerAddress = eoaAccount.address;

  const initData = encodeFunctionData({
    abi: [
      {
        name: "initNexusWithDefaultValidator",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ type: "bytes", name: "data" }],
        outputs: [],
      },
    ],
    functionName: "initNexusWithDefaultValidator",
    args: [ownerAddress as `0x${string}`],
  });

  const initDataWithBootstrap = encodeAbiParameters(
    [
      { name: "bootstrap", type: "address" },
      { name: "initData", type: "bytes" },
    ],
    [nexusBootstrapAddress, initData]
  );

  // Create initializeAccount calldata
  const initializeNexusCalldata = encodeFunctionData({
    abi: [
      {
        name: "initializeAccount",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ type: "bytes", name: "data" }],
        outputs: [],
      },
    ],
    functionName: "initializeAccount",
    args: [initDataWithBootstrap],
  });

  const initializeNexusTransaction = {
    to: v2AccountAddress,
    data: initializeNexusCalldata,
  };

  // Send both transactions in a batch
  console.log("Sending migration transaction...");
  const userOp = await v2Account.buildUserOp([
    updateImplementationTransaction,
    initializeNexusTransaction,
    {
      to: "0x372371535faDD69CA29E136Ab9e54717f787f9Cf",
      value: parseEther("0"),
    },
  ], {
    paymasterServiceData: {
      mode: PaymasterMode.SPONSORED, 
    }
  });

  const signedUserOp = await v2Account.signUserOp(userOp);

  const bundler = await createBundler({
    chainId: chain.id,
    bundlerUrl: v2BundlerUrl,
  })

  const userOpResponse = await bundler.sendUserOp(
    signedUserOp as UserOperationStruct
  );

  console.log("userOpResponse", userOpResponse);

  const txHashStatus = await userOpResponse.waitForTxHash();

  console.log("txHashStatus", txHashStatus);
  console.log("Migration completed successfully");
}

async function getNexusClient(privateKey: `0x${string}`) {
  const eoaAccount = privateKeyToAccount(privateKey as `0x${string}`);

  console.log("EOA Address:", eoaAccount.address);

  const client = createWalletClient({
    account: eoaAccount,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  const v2Account = await createV2Client({
    signer: client,
    bundlerUrl: v2BundlerUrl,
  });

  console.log("V2 entry point", v2Account.getEntryPointAddress());

  const isV2Deployed = await v2Account.isAccountDeployed();

  console.log("Is account deployed", isV2Deployed);

  let account: NexusAccount;

  const v2AccountAddress = await v2Account.getAccountAddress();
  console.log("V2 Account Address:", v2AccountAddress);

  if (isV2Deployed) {
    account = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(),
      accountAddress: v2AccountAddress,
    });
  } else {
    account = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(),
    });
  }

  const nexusAccount = createSmartAccountClient({
    account,
    transport: http(v3BundlerUrl),
    paymaster: createBicoPaymasterClient({
      transport: http(v2PaymasterUrl),
    }),
  });

  if (isV2Deployed) {
    try {
      console.log(
        "valid nexus account",
        await nexusAccount.getInstalledValidators()
      );
    } catch (error) {
      console.log(error);
      if (error instanceof ContractFunctionExecutionError) {
        console.log("migratinggggg");

        return;
      }
    }
  }

  console.log("nexus account address", nexusAccount.account.address);

  return nexusAccount;
}

async function testNexusMigration() {
  const nexusAccount = await getNexusClient(
    keysData["wallets"]["smartAccountV2"]["2-2"]["privateKey"]
  );

  console.log("Testing migrated account...");

  const userOperation: CustomUserOperation = await nexusAccount.prepareUserOperation({
    calls: [
      {
        to: "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68",
        value: parseEther("0.000001"),
        // data: "0x",
      },
    ],
  } as any);

  const signature = await nexusAccount.account.signUserOperation(userOperation as CustomSignedUserOperation);

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

async function sendUserOperation(userOperation: any) {
  const params = [
    {
      sender: "0x225D590b2B6D26aAe9Fc8b71a8CF424C7ad3130c",
      nonce: `0x${userOperation.nonce.toString(16)}`,
      // initCode: '0x',
      callData: userOperation.callData,
      signature: userOperation.signature,
      preVerificationGas: `0x${userOperation.preVerificationGas.toString(16)}`,
      verificationGasLimit: `0x${userOperation.verificationGasLimit.toString(
        16
      )}`,
      callGasLimit: `0x${userOperation.callGasLimit.toString(16)}`,
      maxFeePerGas: `0x${userOperation.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOperation.maxPriorityFeePerGas.toString(
        16
      )}`,
      // paymasterAndData: '0x',
    },
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  ];

  console.log("paramsss", params);

  const data = {
    jsonrpc: "2.0",
    method: "eth_sendUserOperation",
    id: new Date().getTime(),
    params,
    // entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
  };

  console.log("dataaa", JSON.stringify(data));
  console.log("v3 bundler url", v3BundlerUrl);

  let response;
  try {
    response = await axios.post(v3BundlerUrl, data);
  } catch (error) {
    console.log("errrrorrr", error.response.data);
  }

  console.log("response", JSON.stringify(response.data));
}

async function testMEEAccountTransaction() {
  const privateKey = keysData["wallets"]["smartAccountV2"]["2"]["privateKey"];

  const eoaAccount = privateKeyToAccount(privateKey as `0x${string}`);

  console.log("EOA Address:", eoaAccount.address);

  const client = createWalletClient({
    account: eoaAccount,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  const v2Account = await createV2Client({
    signer: client,
    bundlerUrl: v2BundlerUrl,
  });

  const v2AccountAddress = await v2Account.getAccountAddress();
  console.log("V2 Account Address:", v2AccountAddress);

  const orchestrator = await toMultichainNexusAccount({
    chains: [chain],
    transports: [http()],
    signer: eoaAccount,
    accountAddress: v2AccountAddress,
  });

  const meeClient = await createMeeClient({
    account: orchestrator,
    apiKey: biconomyApiKey,
  });

  const meeAccountAddress = meeClient.account.addressOn(chain.id);

  console.log("MEE account address:", meeAccountAddress);

  const quote = await meeClient.getQuote({
    instructions: [
      {
        calls: [
          {
            to: "0x6698625Befc07816095E1f017F286027714d1Dd4",
            value: parseEther("0.06"),
          },
        ],
        chainId: chain.id,
      },
    ],
    sponsorship: true,
  });

  console.log("quoteeee", JSON.stringify(quote));

  const signedQuote = await meeClient.signQuote({ quote });

  const senderEOA = privateKeyToAccount(generatePrivateKey() as `0x${string}`);

  const senderOrchestrator = await toMultichainNexusAccount({
    chains: [chain],
    transports: [http()],
    signer: senderEOA,
  });

  const senderMeeClient = await createMeeClient({
    account: senderOrchestrator,
    apiKey: biconomyApiKey,
  });

  console.log(
    "Sender EOA address",
    senderMeeClient.account.addressOn(chain.id)
  );

  const { hash } = await senderMeeClient.executeSignedQuote({ signedQuote });

  console.log("hashhhhh", hash);

  const receipt = await senderMeeClient.waitForSupertransactionReceipt({
    hash,
  });
  console.log("Test transaction successful:", receipt);
}

async function tryFunc() {
  console.log("chain id", chain.id);
  console.log("symbol", chain.nativeCurrency.symbol);
  console.log("decimals", chain.nativeCurrency.decimals);
  console.log("rpc", chain.rpcUrls.default.http[0]);
  console.log("block explorer", chain.blockExplorers.default.url);
}

async function testDeployV2Account() {
  const privateKey = keysData["wallets"]["smartAccountV2"]["2-2"]["privateKey"];

  console.log("private key", privateKey);

  const eoaAccount = privateKeyToAccount(privateKey as `0x${string}`);

  console.log("EOA Address:", eoaAccount.address);

  const client = createWalletClient({
    account: eoaAccount,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  const v2Account = await createV2Client({
    signer: client,
    bundlerUrl: v2BundlerUrl,
  });

  const v2AccountAddress = await v2Account.getAccountAddress();
  console.log("V2 Account Address:", v2AccountAddress);

  await deployV2Account(v2Account);

  const isDeployed = await v2Account.isAccountDeployed();

  console.log("isDeployed", isDeployed);
}

async function main() {
  // await migrateSmartAccountToNexus();
  await testNexusMigration();
  // await testMEEAccountTransaction();
  // await tryFunc();
  // await testDeployV2Account();
}

main().catch(console.error);
