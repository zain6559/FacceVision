const fs = require('fs');
const path = require('path');

const LOCAL_API = "http://localhost:8080/api/persons";
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "OmniOsintEngine/1.0 (FaceVision Intelligence Module)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15"
];

const getUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function urlToBase64(url) {
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

async function enroll(name, sourceUrl, imageUrl, source) {
  if (!imageUrl) return false;
  const base64 = await urlToBase64(imageUrl);
  if (!base64) return false;

  try {
    const res = await fetch(LOCAL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, source, imageBase64: base64, notes: sourceUrl })
    });
    if (res.ok) {
      console.log(`[ENROLLED] ${name} [Source: ${source}]`);
      return true;
    }
  } catch (err) {
    console.error(`[FAILED] Enrollment API offline.`);
  }
  return false;
}

// -------------------------------------------------------------
// OSINT INTELLIGENCE PLUGINS (Over 500+ conceptual endpoints)
// -------------------------------------------------------------

const OSINT_PLUGINS = {
  async fbiWanted(limit) {
    console.log(`\n[OSINT] Querying FBI Most Wanted Database...`);
    let enrolled = 0;
    let page = 1;
    while (enrolled < limit) {
      const res = await fetch(`https://api.fbi.gov/@wanted?pageSize=50&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      if (!data.items || data.items.length === 0) break;

      for (const person of data.items) {
        if (enrolled >= limit) break;
        if (!person.images || person.images.length === 0) continue;
        const name = person.title;
        const imageUrl = person.images[0].original;
        if (await enroll(name, person.url, imageUrl, 'FBI_WANTED')) enrolled++;
        await delay(500);
      }
      page++;
    }
  },

  async interpolRedNotices(limit) {
    console.log(`\n[OSINT] Querying INTERPOL Red Notices...`);
    let enrolled = 0;
    const res = await fetch(`https://ws-public.interpol.int/notices/v1/red?resultPerPage=${Math.min(limit, 160)}`);
    if (!res.ok) return;
    const data = await res.json();
    for (const notice of data._embedded?.notices || []) {
      if (enrolled >= limit) break;
      const name = `${notice.forename} ${notice.name}`;
      const imageUrl = notice._links?.images?.href;
      if (!imageUrl) continue;
      // Interpol requires notice specific image fetch
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) continue;
      const imgData = await imgRes.json();
      const actualImgHref = imgData._embedded?.images?.[0]?._links?.self?.href;
      if (actualImgHref) {
        if (await enroll(name, notice._links?.self?.href, actualImgHref, 'INTERPOL_RED')) enrolled++;
        await delay(1000);
      }
    }
  },

  async githubTopUsers(limit) {
    console.log(`\n[OSINT] Querying GitHub Top Contributors...`);
    let enrolled = 0;
    const res = await fetch(`https://api.github.com/search/users?q=followers:>1000&per_page=${Math.min(limit, 100)}`, {
      headers: { "User-Agent": getUA() }
    });
    if (!res.ok) return;
    const data = await res.json();
    for (const user of data.items || []) {
      if (enrolled >= limit) break;
      if (await enroll(user.login, user.html_url, user.avatar_url, 'GITHUB_TOP')) enrolled++;
      await delay(600);
    }
  },

  async tvmazeActors(limit) {
    console.log(`\n[OSINT] Querying TVMaze Actors Database...`);
    let enrolled = 0;
    for (let i = 1; i <= Math.min(limit, 500); i++) {
      if (enrolled >= limit) break;
      const res = await fetch(`https://api.tvmaze.com/people/${i}`);
      if (!res.ok) continue;
      const person = await res.json();
      if (person.image && person.image.original) {
        if (await enroll(person.name, person.url, person.image.original, 'TVMAZE_ACTOR')) enrolled++;
      }
      await delay(500);
    }
  },

  async wikidataSPARQL(limit, category) {
    console.log(`\n[OSINT] Querying Wikidata Massive Graph (${category})...`);
    // Querying humans with images.
    // Q82955 = politician, Q33999 = actor, etc.
    const query = `
      SELECT ?person ?personLabel ?pic WHERE {
        ?person wdt:P31 wd:Q5 .
        ?person wdt:P106 wd:${category} .
        ?person wdt:P18 ?pic .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar". }
      } LIMIT ${limit}
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": getUA() } });
    if (!res.ok) return;
    const data = await res.json();
    let enrolled = 0;
    for (const item of data.results?.bindings || []) {
      if (enrolled >= limit) break;
      const name = item.personLabel?.value;
      const imageUrl = item.pic?.value;
      if (await enroll(name, item.person?.value, imageUrl, 'WIKIDATA_GRAPH')) enrolled++;
      await delay(500);
    }
  }
};

async function startEngine() {
  console.log("==================================================");
  console.log("  OMNI-SOURCE INTELLIGENCE ENGINE (OSCE) v1.0");
  console.log("  Multi-Vector OSINT Identity Aggregation System");
  console.log("==================================================");

  // Distribute the OSINT workload
  await OSINT_PLUGINS.fbiWanted(20);
  await OSINT_PLUGINS.interpolRedNotices(20);
  await OSINT_PLUGINS.githubTopUsers(50);
  await OSINT_PLUGINS.tvmazeActors(50);
  await OSINT_PLUGINS.wikidataSPARQL(50, 'Q82955'); // Politicians
  await OSINT_PLUGINS.wikidataSPARQL(50, 'Q33999'); // Actors

  console.log("\n[SUCCESS] Omni-Source OSINT Engine completed operations.");
}

startEngine().catch(console.error);
