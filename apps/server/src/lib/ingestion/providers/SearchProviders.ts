/**
 * FaceVision — Search Provider Interface
 * 
 * Abstract interface for search providers to allow easy swapping.
 * Providers: Google, Bing, DuckDuckGo, Yandex, etc.
 */

import { logger } from "../../logger.js";
import type { SearchProvider, SearchOptions, SearchResult } from "../pipeline/types.js";

/**
 * Base search provider with common functionality.
 */
abstract class BaseSearchProvider implements SearchProvider {
  abstract readonly id: string;
  abstract readonly name: string;

  abstract search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  supportsImageSearch(): boolean {
    return true;
  }

  protected createSearchResult(url: string, title: string, snippet: string): SearchResult {
    return {
      url,
      title,
      snippet,
      source: this.name
    };
  }
}

/**
 * Google Search Provider.
 */
class GoogleSearchProvider extends BaseSearchProvider {
  readonly id = "google";
  readonly name = "Google";

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    logger.debug({ provider: this.id, query }, "Executing search");
    
    // In production: use Google Custom Search API or scrape
    // For now, return simulated results
    return this.simulateSearch(query, options?.limit || 10);
  }

  private simulateSearch(query: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    for (let i = 0; i < Math.min(limit, 5); i++) {
      results.push(this.createSearchResult(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${i * 10}`,
        `Result ${i + 1} for ${query}`,
        `Search result snippet ${i + 1}...`
      ));
    }
    return results;
  }
}

/**
 * Bing Search Provider.
 */
class BingSearchProvider extends BaseSearchProvider {
  readonly id = "bing";
  readonly name = "Bing";

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    logger.debug({ provider: this.id, query }, "Executing search");
    
    return this.simulateSearch(query, options?.limit || 10);
  }

  private simulateSearch(query: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    for (let i = 0; i < Math.min(limit, 5); i++) {
      results.push(this.createSearchResult(
        `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        `Bing Result ${i + 1}: ${query}`,
        `Bing search result snippet ${i + 1}...`
      ));
    }
    return results;
  }
}

/**
 * DuckDuckGo Search Provider.
 */
class DuckDuckGoSearchProvider extends BaseSearchProvider {
  readonly id = "duckduckgo";
  readonly name = "DuckDuckGo";

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    logger.debug({ provider: this.id, query }, "Executing search");
    
    return this.simulateSearch(query, options?.limit || 10);
  }

  private simulateSearch(query: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    for (let i = 0; i < Math.min(limit, 5); i++) {
      results.push(this.createSearchResult(
        `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        `DuckDuckGo: ${query} - Result ${i + 1}`,
        `Privacy-focused search result ${i + 1}...`
      ));
    }
    return results;
  }
}

/**
 * Yandex Search Provider.
 */
class YandexSearchProvider extends BaseSearchProvider {
  readonly id = "yandex";
  readonly name = "Yandex";

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    logger.debug({ provider: this.id, query }, "Executing search");
    
    return this.simulateSearch(query, options?.limit || 10);
  }

  private simulateSearch(query: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    for (let i = 0; i < Math.min(limit, 5); i++) {
      results.push(this.createSearchResult(
        `https://yandex.com/search/?text=${encodeURIComponent(query)}`,
        `Yandex: ${query} #${i + 1}`,
        `Russian search engine result ${i + 1}...`
      ));
    }
    return results;
  }
}

/**
 * Search Provider Registry - Manages all available providers.
 */
export class SearchProviderRegistry {
  private providers: Map<string, SearchProvider> = new Map();
  private defaultProvider: string = "duckduckgo";

  constructor() {
    // Register default providers
    this.register(new GoogleSearchProvider());
    this.register(new BingSearchProvider());
    this.register(new DuckDuckGoSearchProvider());
    this.register(new YandexSearchProvider());
  }

  /**
   * Register a new search provider.
   */
  register(provider: SearchProvider): void {
    this.providers.set(provider.id, provider);
    logger.info({ providerId: provider.id, name: provider.name }, "Search provider registered");
  }

  /**
   * Unregister a search provider.
   */
  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Get a provider by ID.
   */
  get(providerId: string): SearchProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get the default provider.
   */
  getDefault(): SearchProvider {
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error(`Default provider ${this.defaultProvider} not found`);
    }
    return provider;
  }

  /**
   * Set the default provider.
   */
  setDefault(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider ${providerId} not registered`);
    }
    this.defaultProvider = providerId;
  }

  /**
   * Get all registered providers.
   */
  getAllProviders(): SearchProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Search using a specific provider or default.
   */
  async search(
    query: string,
    providerId?: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const provider = providerId 
      ? this.providers.get(providerId) 
      : this.getDefault();

    if (!provider) {
      throw new Error(`Provider ${providerId || this.defaultProvider} not found`);
    }

    return provider.search(query, options);
  }

  /**
   * Aggregate search results from multiple providers.
   */
  async aggregateSearch(
    query: string,
    providerIds: string[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const providers = providerIds.length > 0
      ? providerIds.map(id => this.providers.get(id)).filter(Boolean) as SearchProvider[]
      : this.getAllProviders();

    const results = await Promise.all(
      providers.map(p => p.search(query, options).catch(() => []))
    );

    // Deduplicate by URL
    const seen = new Set<string>();
    return results.flat().filter(result => {
      if (seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    });
  }
}

// Singleton instance
export const searchProviderRegistry = new SearchProviderRegistry();
