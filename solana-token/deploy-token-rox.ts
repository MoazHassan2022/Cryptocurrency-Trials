import * as fs from "fs";
import { join } from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmRawTransaction,
  Signer,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMasterEditionV3Instruction,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";

const RPC_URL = process.env.ROX_RPC_URL ?? "https://roxchain.roxcustody.io";

// Token details
const NAME = "Sample Token";
const SYMBOL = "SMT";
const DECIMALS = 0;

const INITIAL_SUPPLY = 1 * Math.pow(10, DECIMALS);

const keysPath = join(process.cwd(), "account-secrets.json");
const keysData = JSON.parse(fs.readFileSync(keysPath, "utf8"));

function recreateWalletFromPrivateKey(privateKey: string) {
  return Keypair.fromSecretKey(
    Uint8Array.from(Buffer.from(privateKey, "base64"))
  );
}

async function requestAirdrop(wallet: Keypair) {
  const connection = new Connection(RPC_URL, "confirmed");
  const airdropSignature = await connection.requestAirdrop(
    wallet.publicKey,
    100 * 1_000_000_000
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

  console.log("owner address in metadata instruction", ownerAddress.toBase58());

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
          uri: "https://custody-dev-public.s3.amazonaws.com/moaz_token_43_1756395090740.json",
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
  const connection = new Connection(RPC_URL, "finalized");

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

  console.log(
    "recipient associated token account address",
    recipientATAPublicKey.toBase58()
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
    createMasterEditionIx
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

async function main() {
  console.log("RPC:", RPC_URL);

  // await requestAirdrop(
  //   recreateWalletFromPrivateKey(keysData["wallets"]["1"]["privateKey"])
  // );

  await deployNonFungibleToken();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
