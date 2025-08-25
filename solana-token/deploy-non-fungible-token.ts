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
  createCreateMasterEditionV3Instruction,
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";

const DECIMALS = 0;
const INITIAL_SUPPLY = 1 * 10 ** DECIMALS;
const RPC_URL = clusterApiUrl("devnet");

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));

function recreateWalletFromPrivateKey(privateKey: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(Buffer.from(privateKey, "base64"))
  );
}

function createWallet() {
  const solanaWallet = Keypair.generate();
  const privateKey = Buffer.from(solanaWallet.secretKey).toString("base64");
  const address = solanaWallet.publicKey.toBase58();

  console.log("private key", privateKey);
  console.log("address", address);

  return solanaWallet;
}

async function requestAirdrop(wallet: Keypair) {
  const connection = new Connection(RPC_URL, "confirmed");
  const airdropSignature = await connection.requestAirdrop(
    wallet.publicKey,
    1
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

  console.log('owner address in metadata instruction', ownerAddress.toBase58());

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
          name: "Moza Non Fungible Token",
          symbol: "MZNFT",
          uri: "https://custody-dev1.s3.amazonaws.com/metadata.json",
          sellerFeeBasisPoints: 0, // e.g. 500%, creators array will get 5% out of any sale happens in any marketplace (advisory field, they are not required to do this)
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: false, // false for immutable (perfect for NFTs)
        collectionDetails: null,
      },
    }
  );
}

function createMasterEditionInstruction(
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

  const [masterEditionPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Master Edition marks it as a Non-Fungible token.
  // maxSupply: set to 0 to make supply non-expandable, typical for 1/1 NFTs, if it is set for example 10, anyone can "fork" the NFT and mint 10 more of them;
  return createCreateMasterEditionV3Instruction(
    {
      metadata: metadataPDA,
      edition: masterEditionPDA,
      mint: tokenMintAddress,
      mintAuthority: ownerAddress,
      payer: payerAddress,
      updateAuthority: ownerAddress,
    },
    {
      createMasterEditionArgs: {
        maxSupply: 0, // Non-expandable; typical for 1/1 NFTs
      },
    }
  );
}

async function deployNonFungibleToken() {
  const connection = new Connection(RPC_URL, "confirmed");

  const payerKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["1"]["privateKey"]
  );

  const recipientKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["2"]["privateKey"]
  );

  const ownerKeyPair = recreateWalletFromPrivateKey(
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
    recipientKeyPair.publicKey, // owner
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

  const createMasterEditionIx = createMasterEditionInstruction(
    mintKeypair.publicKey,
    ownerKeyPair.publicKey,
    payerKeyPair.publicKey
  );

  const transaction = new Transaction().add(
    createMintIx,
    initMintIx,
    recipientATACreationIX,
    mintToIx,
    createMetadataIx,
    createMasterEditionIx,
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payerKeyPair.publicKey;

  transaction.sign(payerKeyPair, mintKeypair, ownerKeyPair);

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

async function mintTokenAmount(
  tokenMintAddress: PublicKey,
  payer: Keypair,
  mintAuthority: Keypair,
  recipientAddress: PublicKey,
  amount: number
) {
  const connection = new Connection(RPC_URL, "confirmed");

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
    createMintToInstruction(
      tokenMintAddress,
      recipientATAPublicKey,
      mintAuthority.publicKey,
      amount * Math.pow(10, DECIMALS)
    )
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payer.publicKey;

  transaction.sign(payer, mintAuthority);

  const rawTx = transaction.serialize();

  const txSignature = await connection.sendRawTransaction(rawTx);

  console.log("txSignature", txSignature);
}

async function sendSol() {
  const walletKeyPair = recreateWalletFromPrivateKey(
    keysData["wallets"]["3"]["privateKey"]
  )
  // send 2 SOL from walletKeyPair to HZvxDhYGztDmp7tooHWca1dbxMo8jVLJHowgzYBBdGCf

  const connection = new Connection(RPC_URL, "confirmed");

  const transaction = new Transaction();

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: walletKeyPair.publicKey,
      toPubkey: new PublicKey("HZvxDhYGztDmp7tooHWca1dbxMo8jVLJHowgzYBBdGCf"),
      lamports: 900000000,
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = walletKeyPair.publicKey;

  transaction.sign(walletKeyPair);

  const rawTx = transaction.serialize();

  const txSignature = await connection.sendRawTransaction(rawTx);

  console.log("txSignature", txSignature);
}

async function main() {
  await sendSol();
  // const wallet = createWallet();
  // await deployNonFungibleToken();
  // await sendTokenAmount(
  //   new PublicKey("6rY4EMCqUGFPhqjRp9JLw6zrgVVguEPbKScdRaXatkVG"),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["1"]["privateKey"]),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["2"]["privateKey"]),
  //   new PublicKey("A51iQm72KSwsYVrFaPye8HDo1nJUGjKaYGStKEQo4gaw"),
  //   1
  // );
  // await mintTokenAmount(
  //   new PublicKey("6rY4EMCqUGFPhqjRp9JLw6zrgVVguEPbKScdRaXatkVG"),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["1"]["privateKey"]),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["2"]["privateKey"]),
  //   new PublicKey("A51iQm72KSwsYVrFaPye8HDo1nJUGjKaYGStKEQo4gaw"),
  //   100
  // );
}

main().catch(console.error);
