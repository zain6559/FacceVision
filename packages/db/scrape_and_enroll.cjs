const WIKI_API = "https://en.wikipedia.org/w/api.php";
const UA = "FaceVisionResearch/4.0 (academic; contact@facevision.ai)";

async function fetchWikipediaData(wikiTitle) {
  try {
    const url = `${WIKI_API}?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages|langlinks&lllang=ar&format=json&pithumbsize=500&redirects=1`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0];

    const thumbUrl = page?.thumbnail?.source ?? null;
    const nameAr = page?.langlinks?.[0]?.["*"] ?? null;

    return { thumbUrl, nameAr };
  } catch (err) {
    console.error(`Error fetching Wiki data for ${wikiTitle}:`, err.message);
    return null;
  }
}

async function imageUrlToBase64(imageUrl) {
  try {
    const res = await fetch(imageUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch (err) {
    console.error(`Error downloading image ${imageUrl}:`, err.message);
    return null;
  }
}

async function enrollPerson(name, nameAr, source, imageBase64) {
  try {
    const res = await fetch("http://localhost:8080/api/persons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nameAr, source, imageBase64 })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`Successfully enrolled: ${name} (ID: ${data.id})`);
    } else {
      console.error(`Failed to enroll ${name}:`, data);
    }
  } catch (err) {
    console.error(`Error enrolling ${name}:`, err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node scrape_and_enroll.cjs <source_name> <wiki_title_1> <wiki_title_2> ...");
    process.exit(1);
  }

  const source = args[0];
  const wikis = args.slice(1);

  console.log(`Starting swarm enrollment for ${wikis.length} persons under source "${source}"...`);

  for (const wiki of wikis) {
    const name = wiki.replace(/_/g, " ");
    console.log(`Processing ${name}...`);
    const wikiData = await fetchWikipediaData(wiki);
    if (!wikiData || !wikiData.thumbUrl) {
      console.log(`No portrait found for ${name}, skipping.`);
      continue;
    }

    const base64 = await imageUrlToBase64(wikiData.thumbUrl);
    if (!base64) {
      console.log(`Failed to download image for ${name}, skipping.`);
      continue;
    }

    await enrollPerson(name, wikiData.nameAr, source, base64);
  }

  console.log("Process finished.");
}

main();
