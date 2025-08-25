import { join } from "path";
import * as fs from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
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
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";

const DECIMALS = 7;
const INITIAL_SUPPLY = 1_000_000 * 10 ** DECIMALS;
const RPC_URL = clusterApiUrl("devnet");

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));

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
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  return createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint: tokenMintAddress,
      mintAuthority: ownerAddress,
      payer: payerAddress,
      updateAuthority: ownerAddress,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: "MozaToken",
          symbol: "MZT",
          uri: "https://custody-dev1.s3.amazonaws.com/metadata.json",
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

async function deployFungibleToken() {
  const connection = new Connection(RPC_URL, "confirmed");

  const payerKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["1"]["privateKey"]
  );

  const recipientKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["2"]["privateKey"]
  );

  const ownerKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["3"]["privateKey"]
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
    programId: TOKEN_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    DECIMALS,
    ownerKeyPair.publicKey,
    ownerKeyPair.publicKey,
    TOKEN_PROGRAM_ID
  );

  const recipientATAPublicKey = await getAssociatedTokenAddress(
    mintKeypair.publicKey, // mint
    recipientKeyPair.publicKey, // owner of ATA
    false
  );

  const recipientATACreationIX = createAssociatedTokenAccountInstruction(
    payerKeyPair.publicKey, // payer
    recipientATAPublicKey, // recipient associated token account
    recipientKeyPair.publicKey, // recipient public key (owner of the token account)
    mintKeypair.publicKey // token mint address
  );

  const mintToIx = createMintToInstruction(
    mintKeypair.publicKey,
    recipientATAPublicKey,
    ownerKeyPair.publicKey,
    INITIAL_SUPPLY
  );

  const createMetadataIx = createMetadataInstruction(
    mintKeypair.publicKey,
    ownerKeyPair.publicKey,
    payerKeyPair.publicKey
  );

  const transaction = new Transaction().add(
    createMintIx,
    initMintIx,
    recipientATACreationIX,
    mintToIx,
    createMetadataIx
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payerKeyPair.publicKey;

  transaction.sign(payerKeyPair, mintKeypair, ownerKeyPair);

  const sigBase64 = transaction.signature.toString("base64");
  const sigBytes = Buffer.from(sigBase64, "base64");
  const sigBase58 = bs58.encode(new Uint8Array(sigBytes));

  const estimatedFee = await transaction.getEstimatedFee(connection);

  console.log("estimatedFee", estimatedFee);

  console.log("signatureee", sigBase58);

  const rawTx = transaction.serialize();

  const txSignature = await connection.sendRawTransaction(rawTx);

  console.log("txSignature", txSignature);
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
