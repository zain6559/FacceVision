import fetch from "node-fetch";

export interface ExtractedNewsMetadata {
  title: string;
  description: string;
  imageUrl: string;
  articleText: string;
  publishDate?: string;
  author?: string;
  matchedNames: string[];
}

/**
 * News & OpenGraph Extractor Engine (v3.5 OSINT Core)
 *
 * Fetches target web pages, extracts OpenGraph metadata (og:image, og:title),
 * parses JSON-LD structured schemas, and runs a lightweight Named Entity Recognition (NER)
 * rule-engine to extract person names from image captions or article headlines.
 */
export class NewsExtractor {
  private userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ];

  /**
   * Fetches an article and parses OpenGraph / JSON-LD metadata
   */
  public async extractFromUrl(url: string): Promise<ExtractedNewsMetadata> {
    const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch news article from ${url}. HTTP Status: ${response.status}`);
    }

    const html = await response.text();
    return this.parseHtml(html);
  }

  /**
   * Manual HTML parser for OpenGraph tags & JSON-LD
   */
  public parseHtml(html: string): ExtractedNewsMetadata {
    // 1. Extract OpenGraph Image
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
    const imageUrl = ogImageMatch ? ogImageMatch[1] : "";

    // 2. Extract OpenGraph Title
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i) ||
                        html.match(/<title>([^<]+)<\/title>/i);
    const title = ogTitleMatch ? ogTitleMatch[1].trim() : "Untitled Article";

    // 3. Extract OpenGraph Description
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i) ||
                       html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = ogDescMatch ? ogDescMatch[1].trim() : "";

    // 4. Extract Article body text (basic cleanup)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]+?)<\/body>/i);
    let articleText = "";
    if (bodyMatch) {
      // Strip script, style, and HTML tags to keep clean readable text
      articleText = bodyMatch[1]
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // 5. Parse JSON-LD structured schemas
    let author: string | undefined;
    let publishDate: string | undefined;
    const jsonLdMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]+?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.author) {
          author = typeof parsed.author === "string" ? parsed.author : parsed.author.name || parsed.author[0]?.name;
        }
        if (parsed.datePublished) {
          publishDate = parsed.datePublished;
        }
      } catch {
        // Suppress parsing errors on malformed JSON-LD
      }
    }

    // 6. Run lightweight Named Entity Recognition (NER) rule-engine
    // Extract names from title, description, and first 1000 characters of text
    const textPool = `${title}. ${description}. ${articleText.slice(0, 1000)}`;
    const matchedNames = this.extractNamesNER(textPool);

    return {
      title,
      description,
      imageUrl,
      articleText,
      author,
      publishDate,
      matchedNames
    };
  }

  /**
   * Lightweight Regex-based Named Entity Recognition (NER) for English and Arabic names
   */
  public extractNamesNER(text: string): string[] {
    const names = new Set<string>();

    // English Person Name Pattern: Capitalized First & Last names (e.g. John Doe, Elon Musk)
    // Avoid common stop words / month names at the start of sentences
    const englishNameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const englishStopWords = new Set([
      "The", "A", "An", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
      "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
      "November", "December", "In", "On", "At", "By", "This", "That", "There", "Here", "We", "They"
    ]);

    let match;
    while ((match = englishNameRegex.exec(text)) !== null) {
      const nameCandidate = match[1];
      const firstWord = nameCandidate.split(" ")[0];
      if (!englishStopWords.has(firstWord)) {
        names.add(nameCandidate);
      }
    }

    // Arabic Person Name Pattern: e.g., د. أحمد الخالد, محمد بن سلمان, علي حسن
    // Arabic titles: الدكتور, المهندس, الشيخ, الرئيس, الأمير
    const arabicNameRegex = /[\u0600-\u06FF]+/g;
    const words = text.match(arabicNameRegex) || [];
    const arabicStopWords = new Set([
      "في", "من", "على", "إلى", "عن", "مع", "هذا", "هذه", "التي", "الذي", "أن", "ان", "كان", "كانت",
      "تم", "تمت", "بين", "كل", "بعد", "قبل", "خلال", "حيث", "ثم", "أو", "او", "قد", "لقد", "وقال"
    ]);

    // Simple Arabic bigram/trigram parser
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i];
      const w2 = words[i+1];
      const w3 = i < words.length - 2 ? words[i+2] : "";

      if (!arabicStopWords.has(w1) && !arabicStopWords.has(w2) && w1.length > 2 && w2.length > 2) {
        // Detect compound names like "عبد الرحمن" or relationships like "بن سلمان"
        if (w2 === "بن" || w2 === "بنت" || w2 === "عبد" || w1 === "عبد") {
          if (w3 && !arabicStopWords.has(w3)) {
            names.add(`${w1} ${w2} ${w3}`);
            i += 2;
          }
        } else {
          names.add(`${w1} ${w2}`);
          i++;
        }
      }
    }

    return Array.from(names);
  }
}
