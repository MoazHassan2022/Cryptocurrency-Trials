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
      "cb_dm=35ffcb84-0bd9-41d7-b5f0-03a6eef04cfb; coinbase_device_id=ec2fc50e-4e39-406e-a5ef-c6cc4a85199b; advertising_sharing_allowed={%22value%22:true}; _iidt=wHUyQ3DtPZbCM0e8nnTwL1kkWeFIxb6O6TyILCZQAUJobJV6Vz/aGIP4/o0uVNxFlpMX2MkfLRaMQg==; _cfuvid=AS9Sd4ozMRNYFCPpcrdhm8_vPnCC93YJDCbFpycSX.4-1753091749156-0.0.1.1-604800000; __cf_bm=ak810L.DeqvJNnttRi7bDJHqMP7RU0KDSP.bQPbxdHU-1753091749-1.0.1.1-6yRr21iDOEZiFZJz7x18cfpz.zy1WeTjyurXSfKgiBfJHRda7ySEQJep8YRHwd4yaSZQkZGKrgyFpODOEITh4uLiNDEWBH79BITsgf7F_2w; unified-oauth-state-cookie=KSSCYPQUUIZIAMEZRZR6V67O4EEJSXZJEFWXDQGUPGDSTGCXGK5A====; identity_device_id=2143b259-ba86-548c-9127-07e90b6e892c; arkdv=09c61c75d0a6b6c6fca258d9419585e9567839260a13dfb9f805ebbc356e4504; cb-gssc=eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJhdXRoX3RpbWUiOjE3NTMwOTE2NjcsImlzcyI6Imh0dHBzOi8vbG9naW4uY29pbmJhc2UuY29tIiwic3ViIjoiYmNiMTQyOTRmMGJlNjUwZDVlYjkzODg1M2ViMmEyMWYiLCJleHAiOjE3NTU2ODM2NjcsImlhdCI6MTc1MzA5MTY2N30.; unified-session-manager-cookie=MTc1MzA5MTY2OHwyTUREX1g3UEY5ejJ1SURoMEI2YzhYOVRjU202WUwtSW9OWVhpMlVUcUNWSVlIWXBoNHFhS0F3c2FHcGl1U2hVbjVpbVJMMl9DS2tVRUtPa2t6NTQ5N2lkWmhkN1RBZ3RLVnVXNHdaa0xvVGJTRE09fOUVKaA2PFbouvo06XvErElKasaXNJSFxRF3CX9cR6fl; __cf_bm=lebWD1E8arllFl3yx2oG1zbYrA1B_DAoMMUbl.p0kkY-1753092609-1.0.1.1-HuFg0KfUDbvAXnDlCoaGG1ccjESC806xD0.XslByc3IJ.nOZ56HnUkaxwAbKFqhKYj5zkVHT571eIBrpgTD0lcjRWMYdBEPG5yyLcCs.9UQ; _cfuvid=nO0hFSjnLOzBwtAUFJSXamq9J_EL2nqvaKs0PYpeQ.E-1753092609443-0.0.1.1-604800000"
    );
    myHeaders.append("Sec-Fetch-Dest", "empty");
    myHeaders.append("Sec-Fetch-Mode", "cors");
    myHeaders.append("Sec-Fetch-Site", "same-site");
    myHeaders.append("Priority", "u=0");
    myHeaders.append("TE", "trailers");

    const raw = JSON.stringify({
      network: "base-sepolia",
      address: "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68",
      token: "eth",
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    fetch(
      "https://cloud-api.coinbase.com/platform/projects/caeaa09e-d3fa-4394-a062-1942f8dedb2d/v2/evm/faucet",
      requestOptions as any
    )
      .then((response) => response.text())
      .then((result) => console.log(result))
      .catch((error) => console.error(error));

    await new Promise((resolve) => setTimeout(resolve, 5000 + Math.random()));
  }
}

main().catch(console.error);
