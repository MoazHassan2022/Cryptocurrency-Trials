import bs58 from "bs58";

// your base58 private key
const base58Key = "65JsyiuZdtrFkYmuNGKGZoppBpeYULVrLUybHJyXC7AWUY3GbSnhqAW5jrF3UaXE2GtCPimp9HeWznbGuBP5EP39";

// decode from base58 → Uint8Array
const keyBytes = bs58.decode(base58Key);

// encode to base64
const base64Key = Buffer.from(keyBytes).toString("base64");

console.log("Base64:", base64Key);
