async function test() {
  const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const blob = await fetch(base64).then(r => r.blob());
  const fd = new FormData();
  fd.append('file', blob, 'face.png');

  const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd }).then(r => r.json());
  console.log('Upload Result:', uploadRes);

  if (uploadRes.data && uploadRes.data.url) {
    const directUrl = uploadRes.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    console.log('Direct URL:', directUrl);

    const lensRes = await fetch('https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(directUrl), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }).then(r => r.text());

    // Search for Wikipedia patterns
    const wikiMatches = lensRes.match(/wikipedia\.org\/wiki\/([^"'\s\\&]+)/g);
    console.log('Wiki Matches:', wikiMatches ? [...new Set(wikiMatches)] : 'None');
  }
}

test().catch(console.error);
