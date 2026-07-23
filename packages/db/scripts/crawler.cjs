const WIKI_API = "https://en.wikipedia.org/w/api.php";
const UA = "FaceVisionCrawler/5.0 (academic; crawler@facevision.ai)";
const LOCAL_API = "http://localhost:8080/api/persons";

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCategoryMembers(categoryTitle, continueToken = null) {
  try {
    let url = `${WIKI_API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(categoryTitle)}&cmlimit=100&format=json`;
    if (continueToken) {
      url += `&cmcontinue=${encodeURIComponent(continueToken)}`;
    }
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      members: data?.query?.categorymembers ?? [],
      continueToken: data?.continue?.cmcontinue ?? null
    };
  } catch (err) {
    console.error("Error fetching category members:", err.message);
    return null;
  }
}

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

async function enrollPerson(name, nameAr, imageBase64) {
  try {
    const res = await fetch(LOCAL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nameAr, source: "crawler_swarm", imageBase64 })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`[ENROLLED] ${name} (ID: ${data.id})`);
      return true;
    } else {
      console.error(`[FAILED] ${name}:`, data.error || data);
      return false;
    }
  } catch (err) {
    console.error(`[ERROR] enrolling ${name}:`, err.message);
    return false;
  }
}

async function startCrawler(targetCount, initialCategory = "Category:Living_people") {
  console.log(`Starting Swarm Crawler on "${initialCategory}" targeting ${targetCount} faces...`);

  let queue = [initialCategory];
  let visitedCategories = new Set([initialCategory]);
  let visitedPages = new Set();
  let crawledCount = 0;
  let enrolledCount = 0;

  async function getCategoryMembersWithRetry(categoryTitle, continueToken = null, retries = 5) {
    for (let i = 0; i < retries; i++) {
      const res = await getCategoryMembers(categoryTitle, continueToken);
      if (res) return res;
      console.log(`Failed to get members batch, retrying in 5 seconds (attempt ${i + 1}/${retries})...`);
      await delay(5000);
    }
    return null;
  }

  while (queue.length > 0 && enrolledCount < targetCount) {
    const categoryTitle = queue.shift();
    console.log(`Processing category: "${categoryTitle}"`);
    let continueToken = null;

    do {
      if (enrolledCount >= targetCount) {
        console.log(`Target count of ${targetCount} enrolled faces reached!`);
        return;
      }

      console.log(`Fetching next batch of members for "${categoryTitle}" (crawled: ${crawledCount}, enrolled: ${enrolledCount})...`);
      const result = await getCategoryMembersWithRetry(categoryTitle, continueToken);
      if (!result) {
        console.log(`Could not fetch members for category "${categoryTitle}", skipping remaining pages of this category.`);
        break;
      }

      const { members, continueToken: nextToken } = result;
      continueToken = nextToken;

      if (!members || members.length === 0) {
        break;
      }

      for (const member of members) {
        if (enrolledCount >= targetCount) {
          console.log(`Target count of ${targetCount} enrolled faces reached!`);
          return;
        }

        const wikiTitle = member.title;

        // If it's a subcategory (ns === 14), queue it
        if (member.ns === 14) {
          if (!visitedCategories.has(wikiTitle)) {
            visitedCategories.add(wikiTitle);
            queue.push(wikiTitle);
          }
          continue;
        }

        // Only process mainspace articles (ns === 0)
        if (member.ns !== 0) {
          continue;
        }

        if (visitedPages.has(wikiTitle)) {
          continue;
        }
        visitedPages.add(wikiTitle);

        crawledCount++;
        console.log(`[CRAWLING ${crawledCount}] ${wikiTitle}...`);
        const wikiData = await fetchWikipediaData(wikiTitle);
        await delay(400); // Politeness delay to Wikipedia API

        if (!wikiData || !wikiData.thumbUrl) {
          continue;
        }

        const base64 = await imageUrlToBase64(wikiData.thumbUrl);
        await delay(400); // Politeness delay to Wikimedia Commons

        if (!base64) continue;

        const success = await enrollPerson(wikiTitle, wikiData.nameAr, base64);
        if (success) {
          enrolledCount++;
        }

        await delay(1000); // Server breathing delay between face extraction/heavy matching queries
      }

    } while (continueToken && enrolledCount < targetCount);
  }

  console.log(`Crawler swarm completed. Crawled: ${crawledCount}, Enrolled: ${enrolledCount}`);
}

const args = process.argv.slice(2);
const target = parseInt(args[0], 10) || 500; // Defaults to 500 for safety unless specified
const category = args[1] || "Category:Living_people";
startCrawler(target, category).catch(console.error);
