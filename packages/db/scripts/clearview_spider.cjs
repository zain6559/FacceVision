const fs = require('fs');
const { parse } = require('url');
// Using basic fetch for crawling. In production, puppeteer/playwright is used for JS-rendered pages.

const LOCAL_API = "http://localhost:8080/api/persons";
const SEED_URLS = [
  "https://en.wikipedia.org/wiki/List_of_current_heads_of_state_and_government",
  "https://en.wikipedia.org/wiki/Forbes_list_of_billionaires",
  "https://en.wikipedia.org/wiki/List_of_Academy_Award-winning_actors",
  // We can add CNN, BBC, etc., but Wikipedia is safer for predictable DOM structure without JS blocking.
];

const visitedUrls = new Set();
const urlQueue = [...SEED_URLS];
let totalFacesHarvested = 0;

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const getUA = () => "FaceVision-GlobalSpider/1.0 (OSINT Identity Harvester; bot@facevision.ai)";

// Simple regex-based HTML parser to extract links and images without heavy DOM libraries
function extractDataFromHTML(html, baseUrl) {
  const images = [];
  const links = [];

  // Extract images with alt texts (which usually contain the person's name)
  const imgRegex = /<img[^>]+src="([^">]+)"[^>]*alt="([^">]+)"/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1];
    let alt = match[2];
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = new URL(src, baseUrl).href;
    images.push({ src, alt });
  }

  // Extract links to crawl further
  const linkRegex = /<a[^>]+href="([^">]+)"/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('//')) href = 'https:' + href;
    else if (href.startsWith('/')) href = new URL(href, baseUrl).href;

    // Only follow web links, ignore anchors and mailto
    if (href.startsWith('http') && !href.includes(':~:text=')) {
      links.push(href);
    }
  }

  return { images, links };
}

async function imageToBase64(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": getUA() } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch (err) {
    return null;
  }
}

async function startGlobalSpider(targetHarvest) {
  console.log("===============================================================");
  console.log("  GLOBAL IDENTITY SPIDER (OSINT DEEP HARVESTER) v2.0");
  console.log("  Autonomously crawling the web to map every face to a name.");
  console.log("===============================================================");

  while (urlQueue.length > 0 && totalFacesHarvested < targetHarvest) {
    const currentUrl = urlQueue.shift();
    if (visitedUrls.has(currentUrl)) continue;
    visitedUrls.add(currentUrl);

    console.log(`\n[SPIDER] Crawling: ${currentUrl}`);
    try {
      const res = await fetch(currentUrl, { headers: { "User-Agent": getUA() } });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) continue;

      const html = await res.text();
      const { images, links } = extractDataFromHTML(html, currentUrl);

      // Add new links to queue (Breadth-First Search)
      links.slice(0, 20).forEach(link => {
        if (!visitedUrls.has(link)) urlQueue.push(link);
      });

      // Process images
      let facesInPage = 0;
      for (const img of images) {
        if (totalFacesHarvested >= targetHarvest) break;
        // Filter out tiny UI icons by checking name length and common bad words
        if (img.alt.length < 3 || img.alt.length > 50) continue;
        if (img.alt.toLowerCase().includes("icon") || img.alt.toLowerCase().includes("logo")) continue;

        const base64 = await imageToBase64(img.src);
        if (!base64) continue;

        // Send to FaceVision API. The API will run the 5-algo ensemble.
        // If a face is detected, it will be enrolled. If it's a false positive, it gets rejected.
        const enrollRes = await fetch(LOCAL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: img.alt, source: currentUrl, imageBase64: base64 })
        });

        if (enrollRes.ok) {
          console.log(`  -> [HARVESTED] Identity Acquired: ${img.alt}`);
          totalFacesHarvested++;
          facesInPage++;
        }
        await delay(300); // Rate limit our own server
      }

      console.log(`  => Extracted ${facesInPage} identities from this domain.`);
      await delay(1000); // Politeness delay between domains

    } catch (err) {
      console.error(`[ERROR] Failed to crawl ${currentUrl}: ${err.message}`);
    }
  }

  console.log(`\n[SYSTEM] Spider operation halted. Total identities harvested: ${totalFacesHarvested}`);
}

startGlobalSpider(5000).catch(console.error);
