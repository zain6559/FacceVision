async function test() {
  const name = "Steve Jobs";
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(name + " portrait")}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    // Bing stores image sources in murl="http..."
    const matches = html.match(/murl&quot;:&quot;(http[^&]+)&quot;/);
    if (matches) {
      const imgUrl = decodeURIComponent(matches[1]);
      console.log("Bing Image URL:", imgUrl);
    } else {
      console.log("No images found on Bing.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
