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

  console.log('receiver address in metadata instruction', receiverAddress.toBase58());

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
      mintAuthority: receiverAddress,
      payer: payerAddress,
      updateAuthority: receiverAddress,
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

  console.log('receiver address in init mint instruction', receiverKeyPair.publicKey.toBase58());

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

  const createMasterEditionIx = createMasterEditionInstruction(
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
    createMasterEditionIx,
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

async function mintTokenAmount(
  tokenMintAddress: PublicKey,
  payer: Keypair,
  mintAuthority: Keypair,
  receiverAddress: PublicKey,
  amount: number
) {
  const connection = new Connection(RPC_URL, "confirmed");

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
    createMintToInstruction(
      tokenMintAddress,
      receiverATAPublicKey,
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

async function main() {
  // await deployNonFungibleToken();
  // await sendTokenAmount(
  //   new PublicKey("6rY4EMCqUGFPhqjRp9JLw6zrgVVguEPbKScdRaXatkVG"),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["1"]["privateKey"]),
  //   recreateWalletFromPrivateKey(keysData["wallets"]["2"]["privateKey"]),
  //   new PublicKey("A51iQm72KSwsYVrFaPye8HDo1nJUGjKaYGStKEQo4gaw"),
  //   1
  // );
  await mintTokenAmount(
    new PublicKey("6rY4EMCqUGFPhqjRp9JLw6zrgVVguEPbKScdRaXatkVG"),
    recreateWalletFromPrivateKey(keysData["wallets"]["1"]["privateKey"]),
    recreateWalletFromPrivateKey(keysData["wallets"]["2"]["privateKey"]),
    new PublicKey("A51iQm72KSwsYVrFaPye8HDo1nJUGjKaYGStKEQo4gaw"),
    100
  );
}

main().catch(console.error);
