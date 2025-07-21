async function main() {
  for (let i = 0; i < 1000; i++) {
    const myHeaders = new Headers();
    myHeaders.append(
      "User-Agent",
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
    );
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Accept-Language", "en-US,en;q=0.5");
    myHeaders.append("Accept-Encoding", "gzip, deflate, br, zstd");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Origin", "https://portal.cdp.coinbase.com");
    myHeaders.append("Connection", "keep-alive");
    myHeaders.append("Referer", "https://portal.cdp.coinbase.com/");
    myHeaders.append(
      "Cookie",
      "cb_dm=35ffcb84-0bd9-41d7-b5f0-03a6eef04cfb; coinbase_device_id=ec2fc50e-4e39-406e-a5ef-c6cc4a85199b; advertising_sharing_allowed={%22value%22:true}; _iidt=qz9Fl1GNHMKfVUl1V1Wwf4IQvwPJxnNydjAfy1CjslmDZdKKn7sjD2OfOx01aQ5ZkJAdvY31lzs8yTPpd8sa/Wew65LeYwQ0G77Qu80=; _cfuvid=jGx4noLF7vHDuNXDB1Ci4joxGMLy2TbOLlVMe5aUtGY-1753098052528-0.0.1.1-604800000; __cf_bm=fm3aEbIAzz6T99gLcCxw1its.seM0MKEGTZe59JgaaE-1753098270-1.0.1.1-_TZfHDd6zN.6uEXU2_Stvt66FFKsq7omehi77.94Zbv5WrB9VxcFkCaKSvFV6_tOe93Bz58rlqObSUOkhLX4i7XkKH5RZbyV.70MY.YQX1ExfpFq5Hrxb9dNU3qIZbAs; unified-oauth-state-cookie=VAY7GE4TMJLNQMA2Z62WCIEZVHB6M6XOCEN2RUPKMJFI772PTILA====; identity_device_id=2143b259-ba86-548c-9127-07e90b6e892c; oauth-locker=unified-access-7443a8e56ac4b40781ff61970309ad48d8b6ad254656e19a70c24dc3cd72c525; arkdv=09c61c75d0a6b6c6fca258d9419585e9567839260a13dfb9f805ebbc356e4504; cb-gssc=eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJhdXRoX3RpbWUiOjE3NTMwOTgyNzAsImlzcyI6Imh0dHBzOi8vbG9naW4uY29pbmJhc2UuY29tIiwic3ViIjoiOWU0ZjE0OGRjNjczOWY4MjI1ZTVlY2ZmODcxNmJhZjMiLCJleHAiOjE3NTU2OTAyNzAsImlhdCI6MTc1MzA5ODI3MH0.; unified-session-manager-cookie=MTc1MzA5ODI3MXxnTFMxY3pzOXdBc3luRGY4M0lDODNZcUd4dEI4dWhobkNzTTFpcnJ2czZ4c2xlSlloN01YdVZXRnliTXRRS0pVd2VqSmhCZDVzWXdyYWd6WkVkMndtX3NhTVlIS1NrRUd1XzlKdENydWctSVFlR2c9fG1IbzfEfAUft1KVeQgMr6VcqAcNrl-B1gFm_iv-jjs7; _cfuvid=nO0hFSjnLOzBwtAUFJSXamq9J_EL2nqvaKs0PYpeQ.E-1753092609443-0.0.1.1-604800000"
    );
    myHeaders.append("Sec-Fetch-Dest", "empty");
    myHeaders.append("Sec-Fetch-Mode", "cors");
    myHeaders.append("Sec-Fetch-Site", "same-site");
    myHeaders.append("Priority", "u=0");
    myHeaders.append("TE", "trailers");

    const raw = JSON.stringify({
      network: "base-sepolia",
      address: "0x256FF0905edbd0211a422D42f933d853cc9FfcFf",
      token: "eth",
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    fetch(
      "https://cloud-api.coinbase.com/platform/projects/6e70cc29-9f7d-4a91-a663-200b62ea6c07/v2/evm/faucet",
      requestOptions as any
    )
      .then((response) => response.text())
      .then((result) => console.log(result))
      .catch((error) => console.error(error));

    await new Promise((resolve) => setTimeout(resolve, 5000 + Math.random()));
  }
}

main().catch(console.error);
