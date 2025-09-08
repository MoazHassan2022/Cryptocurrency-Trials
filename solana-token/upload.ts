import axios from "axios";
import * as fs from "fs";

const file = fs.readFileSync("./logo.png");

console.log('lengthhh', file.length);
async function upload() {
  const presignedUrl = "https://custody-dev-public.s3.amazonaws.com/rox/tokenization/ddcf46ce-53dd-4fbd-8ad2-ccebc993f3e20?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA3LJ5KKO4QDOYQBHP%2F20250908%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20250908T082448Z&X-Amz-Expires=21600&X-Amz-Signature=5f13f648436ab4d38de616bb3f7ad84e0843d9c6d2baed5317732ece232f2e78&X-Amz-SignedHeaders=content-length%3Bhost&x-amz-acl=public-read&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-meta-filename=logo.png&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject";

  await axios.put(presignedUrl, file, {
    headers: {
      "Content-Type": "image/png",
    },
  });

  console.log("✅ Upload successful");
}

upload().catch(err => {
  console.error("❌ Upload failed", err.response?.status, err.response?.data);
});
