import { join } from "path";
import * as fs from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  getMinimumBalanceForRentExemptAccount,
  ACCOUNT_SIZE,
  createInitializeAccount3Instruction,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";

const tokenProgramId = TOKEN_PROGRAM_ID // new PublicKey(
//   "EPGLzKJfA6iDshbox4sy7zjxANfD15yfs83qehFfnbEh"
// );
const tokenAssociatedAccountProgramId = new PublicKey(
  "DePYbJ1fuG5rRix41rXP3gBhxSjtmuA8DAR21RrpDCzf"
);
const tokenMetadataProgramId = TOKEN_METADATA_PROGRAM_ID // new PublicKey(
//   "Axuy7mWKg57HRmcrD623WSg4M59ksadXnLgttH82N4zv"
// );

const NAME = "Sample Token";
const SYMBOL = "SMT";
const DECIMALS = 9;
const INITIAL_SUPPLY = 1_000 * 10 ** DECIMALS;
const RPC_URL = clusterApiUrl("devnet");

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));

async function deployFungibleToken() {
  const connection = new Connection(
    RPC_URL, // "https://roxchain.roxcustody.io",
    "finalized"
  );

  const payerKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["1"]["privateKey"]
  );

  const recipientKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["1"]["privateKey"]
  );

  const ownerKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["1"]["privateKey"]
  );

  // fungible token is considered as minting account
  const mintKeypair = Keypair.generate();

  console.log("token mint address", mintKeypair.publicKey.toBase58());

  const requiredLamportsForMint = await getMinimumBalanceForRentExemptMint(
    connection
  );

  // Ix stands for Instruction, like Tx stands for Transaction
  const createMintIx = SystemProgram.createAccount({
    fromPubkey: payerKeyPair.publicKey, // to pay for account creation
    newAccountPubkey: mintKeypair.publicKey, // token new address
    space: MINT_SIZE,
    lamports: requiredLamportsForMint,
    programId: tokenProgramId, // token program id,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    DECIMALS,
    ownerKeyPair.publicKey,
    ownerKeyPair.publicKey,
    tokenProgramId // token program id
  );

  const tokenAccount = Keypair.generate();
  const rentForAccount = await getMinimumBalanceForRentExemptAccount(connection);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payerKeyPair.publicKey,
    newAccountPubkey: tokenAccount.publicKey,
    space: ACCOUNT_SIZE,
    lamports: rentForAccount,
    programId: tokenProgramId,
  });

  const initAccountIx = createInitializeAccount3Instruction(
    tokenAccount.publicKey,
    mintKeypair.publicKey,
    recipientKeyPair.publicKey,
    tokenProgramId
  );

  // const recipientATAPublicKey = await getAssociatedTokenAddress(
  //   mintKeypair.publicKey, // mint
  //   recipientKeyPair.publicKey, // owner of ATA
  //   false,
  //   tokenProgramId,
  //   tokenAssociatedAccountProgramId
  // );

  // console.log(
  //   "recipient associated token account address",
  //   recipientATAPublicKey.toBase58()
  // );

  // const recipientATACreationIX = createAssociatedTokenAccountInstruction(
  //   payerKeyPair.publicKey, // payer
  //   recipientATAPublicKey, // recipient associated token account
  //   recipientKeyPair.publicKey, // recipient public key (owner of the token account)
  //   mintKeypair.publicKey, // token mint address
  //   tokenProgramId,
  //   tokenAssociatedAccountProgramId
  // );

  const mintToIx = createMintToInstruction(
    mintKeypair.publicKey,
    tokenAccount.publicKey,
    ownerKeyPair.publicKey,
    INITIAL_SUPPLY,
    undefined,
    tokenProgramId
  );

  const createMetadataIx = createMetadataInstruction(
    mintKeypair.publicKey,
    ownerKeyPair.publicKey,
    payerKeyPair.publicKey
  );

  const transaction = new Transaction().add(
    createMintIx,
    initMintIx,
    createAccountIx,
    initAccountIx,
    mintToIx,
    createMetadataIx,
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payerKeyPair.publicKey;

  transaction.sign(payerKeyPair, mintKeypair, tokenAccount); //, ownerKeyPair);

  const sigBase64 = transaction.signature.toString("base64");
  const sigBytes = Buffer.from(sigBase64, "base64");
  const sigBase58 = bs58.encode(new Uint8Array(sigBytes));

  const estimatedFee = await transaction.getEstimatedFee(connection);

  console.log("estimatedFee", estimatedFee);

  const feePayerBalance = await connection.getBalance(
    new PublicKey(payerKeyPair.publicKey.toBase58())
  );

  console.log("feePayerBalance", feePayerBalance);

  console.log("signatureee", sigBase58);

  const rawTx = transaction.serialize();

  try {
    const txSignature = await connection.sendRawTransaction(rawTx, {
      preflightCommitment: "finalized",
    });

    console.log("txSignature", txSignature);
  } catch (err: any) {
    console.error("Transaction failed:", err);
  }
}

function recreateWalletFromPrivateKey(privateKey: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(Buffer.from(privateKey, "base64"))
  );
}

async function createWallet() {
  const solanaWallet = Keypair.generate();
  const privateKey = Buffer.from(solanaWallet.secretKey).toString("base64");
  const address = solanaWallet.publicKey.toBase58();

  console.log("private key", privateKey);
  console.log("address", address);
}

async function requestAirdrop(wallet: Keypair) {
  const connection = new Connection(RPC_URL, "confirmed");
  const airdropSignature = await connection.requestAirdrop(
    wallet.publicKey,
    2e9
  );
  await connection.confirmTransaction(airdropSignature, "finalized");
}

function createMetadataInstruction(
  tokenMintAddress: PublicKey,
  ownerAddress: PublicKey,
  payerAddress: PublicKey
) {
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      tokenMetadataProgramId.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    tokenMetadataProgramId
  );

  return createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint: tokenMintAddress,
      mintAuthority: ownerAddress,
      payer: payerAddress,
      updateAuthority: ownerAddress,
      systemProgram: SystemProgram.programId,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: NAME,
          symbol: SYMBOL,
          uri: "https://custody-dev-public.s3.amazonaws.com/sample_token_1756199945100.json",
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );
}

async function sendTokenAmount(
  tokenMintAddress: PublicKey,
  payer: Keypair,
  sender: Keypair,
  recipientAddress: PublicKey,
  amount: number
) {
  const connection = new Connection(RPC_URL, "confirmed");

  const senderATAPublicKey = await getAssociatedTokenAddress(
    tokenMintAddress, // mint
    sender.publicKey, // owner
    false
  );

  const recipientATAPublicKey = await getAssociatedTokenAddress(
    tokenMintAddress, // mint
    recipientAddress, // owner
    false
  );

  const destinationAccountInfo = await connection.getAccountInfo(
    recipientATAPublicKey
  );
  const transaction = new Transaction();

  if (!destinationAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        recipientATAPublicKey,
        recipientAddress,
        tokenMintAddress
      )
    );
  }

  transaction.add(
    createTransferCheckedInstruction(
      senderATAPublicKey,
      tokenMintAddress,
      recipientATAPublicKey,
      sender.publicKey,
      amount * Math.pow(10, DECIMALS),
      DECIMALS
    )
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payer.publicKey;

  transaction.sign(payer, sender);

  const rawTx = transaction.serialize();

  const txSignature = await connection.sendRawTransaction(rawTx);

  console.log("txSignature", txSignature);
}

async function main() {
  await deployFungibleToken();
  // await sendTokenAmount(
  //   new PublicKey("HD8YLrfSAbztpLWmhnfdTnj8TKSBczcKtGQXZNzbzsav"),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["1"]["privateKey"]),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["2"]["privateKey"]),
  //   new PublicKey("A51iQm72KSwsYVrFaPye8HDo1nJUGjKaYGStKEQo4gaw"),
  //   1000
  // );
}

main().catch(console.error);
