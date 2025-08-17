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
  receiverAddress: PublicKey,
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
      mintAuthority: receiverAddress,
      payer: payerAddress,
      updateAuthority: receiverAddress,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: "MozaToken",
          symbol: "MZT",
          uri: "https://example.com/metadata.json",
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

  const payerKeyPayer = recreateWalletFromPrivateKey(
    keysData["wallets"]["1"]["privateKey"]
  );

  const receiverKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["2"]["privateKey"]
  );

  // fungible token is considered as minting account
  const mintKeypair = Keypair.generate();

  console.log("token mint address", mintKeypair.publicKey.toBase58());

  const requiredLamportsForMint = await getMinimumBalanceForRentExemptMint(
    connection
  );

  // Ix stands for Instruction, like Tx stands for Transaction
  const createMintIx = SystemProgram.createAccount({
    fromPubkey: payerKeyPayer.publicKey, // to pay for account creation
    newAccountPubkey: mintKeypair.publicKey, // token new address
    space: MINT_SIZE,
    lamports: requiredLamportsForMint,
    programId: TOKEN_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    DECIMALS,
    receiverKeyPair.publicKey,
    receiverKeyPair.publicKey,
    TOKEN_PROGRAM_ID
  );

  const receiverATAPublicKey = await getAssociatedTokenAddress(
    mintKeypair.publicKey, // mint
    receiverKeyPair.publicKey, // owner
    false
  );

  const receiverATACreationIX = createAssociatedTokenAccountInstruction(
    payerKeyPayer.publicKey, // payer
    receiverATAPublicKey, // receiver associated token account
    receiverKeyPair.publicKey, // receiver public key (owner of the token account)
    mintKeypair.publicKey // token mint address
  );

  const mintToIx = createMintToInstruction(
    mintKeypair.publicKey,
    receiverATAPublicKey,
    receiverKeyPair.publicKey,
    INITIAL_SUPPLY
  );

  const createMetadataIx = createMetadataInstruction(
    mintKeypair.publicKey,
    receiverKeyPair.publicKey,
    payerKeyPayer.publicKey
  );

  const transaction = new Transaction().add(
    createMintIx,
    initMintIx,
    receiverATACreationIX,
    mintToIx,
    createMetadataIx,
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payerKeyPayer.publicKey;

  transaction.sign(payerKeyPayer, mintKeypair, receiverKeyPair);

  const rawTx = transaction.serialize();

  const txSignature = await connection.sendRawTransaction(rawTx);

  console.log("txSignature", txSignature);
}

async function sendTokenAmount(
  tokenMintAddress: PublicKey,
  payer: Keypair,
  sender: Keypair,
  receiverAddress: PublicKey,
  amount: number
) {
  const connection = new Connection(RPC_URL, "confirmed");

  const senderATAPublicKey = await getAssociatedTokenAddress(
    tokenMintAddress, // mint
    sender.publicKey, // owner
    false
  );

  const receiverATAPublicKey = await getAssociatedTokenAddress(
    tokenMintAddress, // mint
    receiverAddress, // owner
    false
  );

  const destinationAccountInfo = await connection.getAccountInfo(
    receiverATAPublicKey
  );
  const transaction = new Transaction();

  if (!destinationAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        receiverATAPublicKey,
        receiverAddress,
        tokenMintAddress
      )
    );
  }

  transaction.add(
    createTransferCheckedInstruction(
      senderATAPublicKey,
      tokenMintAddress,
      receiverATAPublicKey,
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
