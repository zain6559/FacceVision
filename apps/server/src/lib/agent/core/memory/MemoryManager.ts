/**
 * FaceVision — Memory System
 * 
 * Implements a multi-tier memory architecture:
 * - Working Memory: Current task context
 * - Session Memory: Current conversation/session
 * - Recognition Memory: Face recognition history
 * - Knowledge Memory: Semantic knowledge base
 * - Long-term Memory: Persistent facts and patterns
 */

import { logger } from "../../logger.js";
import type { 
  MemoryEntry, 
  MemoryType, 
  WorkingMemory,
  SessionMemory,
  RecognitionMemory,
  KnowledgeMemory,
  Goal,
  Action,
  ActionResult,
  AgentContext
} from "../types.js";

/**
 * Memory Manager - Handles all memory operations.
 * 
 * Each memory tier has different:
 * - Retention policy (TTL)
 * - Access patterns
 * - Importance scoring
 */
export class MemoryManager {
  private workingMemory: Map<string, MemoryEntry> = new Map();
  private sessionMemory: Map<string, SessionMemory> = new Map();
  private recognitionMemory: Map<string, RecognitionMemory> = new Map();
  private knowledgeMemory: Map<string, MemoryEntry> = new Map();
  private longTermMemory: Map<string, MemoryEntry> = new Map();
  
  // Configuration
  private readonly WORKING_TTL_MS = 5 * 60 * 1000;      // 5 minutes
  private readonly SESSION_TTL_MS = 60 * 60 * 1000;    // 1 hour
  private readonly RECOGNITION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly LONG_TERM_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

  private memoryCounter = 0;

  /**
   * Store in working memory (short-term, task context).
   */
  storeWorking(key: string, value: unknown, importance = 0.5): MemoryEntry {
    const entry: MemoryEntry = {
      id: `wm_${++this.memoryCounter}`,
      type: "WORKING",
      key,
      value,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      importance
    };
    
    this.workingMemory.set(key, entry);
    this.cleanupExpired(this.workingMemory, this.WORKING_TTL_MS);
    
    return entry;
  }

  /**
   * Retrieve from working memory.
   */
  retrieveWorking(key: string): MemoryEntry | undefined {
    const entry = this.workingMemory.get(key);
    if (entry) {
      entry.accessedAt = new Date();
      entry.accessCount++;
    }
    return entry;
  }

  /**
   * Store session data (conversation context).
   */
  storeSession(sessionId: string, session: SessionMemory): void {
    this.sessionMemory.set(sessionId, session);
    this.cleanupExpired(this.sessionMemory, this.SESSION_TTL_MS, true);
  }

  /**
   * Get session memory.
   */
  getSession(sessionId: string): SessionMemory | undefined {
    return this.sessionMemory.get(sessionId);
  }

  /**
   * Update session with new goal/action.
   */
  updateSession(sessionId: string, updates: {
    goals?: Goal[];
    actions?: Action[];
    results?: ActionResult[];
    context?: Record<string, unknown>;
  }): void {
    const session = this.sessionMemory.get(sessionId);
    if (session) {
      if (updates.goals) session.goals.push(...updates.goals);
      if (updates.actions) session.actions.push(...updates.actions);
      if (updates.results) session.results.push(...updates.results);
      if (updates.context) Object.assign(session.context, updates.context);
    }
  }

  /**
   * Store recognition memory (face recognition history).
   */
  storeRecognition(subjectId: string, recognition: Omit<RecognitionMemory, "recognitionCount" | "confidenceHistory">): void {
    const existing = this.recognitionMemory.get(subjectId);
    
    if (existing) {
      existing.lastRecognition = new Date();
      existing.recognitionCount++;
      existing.confidenceHistory.push(recognition.confidenceHistory[0] || 0.5);
      
      // Keep only last 100 confidence scores
      if (existing.confidenceHistory.length > 100) {
        existing.confidenceHistory = existing.confidenceHistory.slice(-100);
      }
      
      if (recognition.locations) {
        existing.locations.push(...recognition.locations);
      }
    } else {
      this.recognitionMemory.set(subjectId, {
        ...recognition,
        recognitionCount: 1,
        confidenceHistory: recognition.confidenceHistory || [0.5]
      });
    }
    
    this.cleanupExpired(this.recognitionMemory, this.RECOGNITION_TTL_MS, true);
  }

  /**
   * Get recognition memory for a subject.
   */
  getRecognition(subjectId: string): RecognitionMemory | undefined {
    return this.recognitionMemory.get(subjectId);
  }

  /**
   * Get all subjects recognized in recent history.
   */
  getRecentRecognitions(limit = 10): RecognitionMemory[] {
    return Array.from(this.recognitionMemory.values())
      .sort((a, b) => b.lastRecognition.getTime() - a.lastRecognition.getTime())
      .slice(0, limit);
  }

  /**
   * Store in knowledge memory (semantic facts).
   */
  storeKnowledge(key: string, value: unknown, importance = 0.7): MemoryEntry {
    const entry: MemoryEntry = {
      id: `km_${++this.memoryCounter}`,
      type: "KNOWLEDGE",
      key,
      value,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      importance
    };
    
    this.knowledgeMemory.set(key, entry);
    return entry;
  }

  /**
   * Retrieve from knowledge memory.
   */
  retrieveKnowledge(key: string): MemoryEntry | undefined {
    const entry = this.knowledgeMemory.get(key);
    if (entry) {
      entry.accessedAt = new Date();
      entry.accessCount++;
    }
    return entry;
  }

  /**
   * Search knowledge memory by pattern.
   */
  searchKnowledge(pattern: string): MemoryEntry[] {
    const lowerPattern = pattern.toLowerCase();
    return Array.from(this.knowledgeMemory.values())
      .filter(entry => {
        const keyMatch = entry.key.toLowerCase().includes(lowerPattern);
        const valueMatch = JSON.stringify(entry.value).toLowerCase().includes(lowerPattern);
        return keyMatch || valueMatch;
      })
      .sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Store in long-term memory (persistent facts).
   */
  storeLongTerm(key: string, value: unknown, importance = 0.8): MemoryEntry {
    const entry: MemoryEntry = {
      id: `ltm_${++this.memoryCounter}`,
      type: "LONG_TERM",
      key,
      value,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      importance
    };
    
    this.longTermMemory.set(key, entry);
    return entry;
  }

  /**
   * Get from long-term memory.
   */
  retrieveLongTerm(key: string): MemoryEntry | undefined {
    const entry = this.longTermMemory.get(key);
    if (entry) {
      entry.accessedAt = new Date();
      entry.accessCount++;
    }
    return entry;
  }

  /**
   * Consolidate working memory to long-term based on importance.
   */
  consolidateToLongTerm(threshold = 0.7): number {
    let count = 0;
    
    for (const [key, entry] of this.workingMemory) {
      if (entry.importance >= threshold) {
        this.storeLongTerm(key, entry.value, entry.importance);
        this.workingMemory.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      logger.info({ count }, "Consolidated working memory to long-term");
    }
    
    return count;
  }

  /**
   * Build agent context from all memory tiers.
   */
  buildContext(sessionId: string): Partial<AgentContext> {
    const session = this.sessionMemory.get(sessionId);
    const workingMem: Map<string, MemoryEntry> = new Map(this.workingMemory);
    const recognitionMem: Map<string, RecognitionMemory> = new Map(this.recognitionMemory);
    const knowledgeMem: Map<string, unknown> = new Map(
      Array.from(this.knowledgeMemory.entries()).map(([k, v]) => [k, v.value])
    );
    const longTermMem: Map<string, MemoryEntry> = new Map(this.longTermMemory);

    return {
      sessionMemory: session!,
      workingMemory: workingMem,
      recognitionMemory: recognitionMem,
      knowledgeMemory: knowledgeMem,
      longTermMemory: longTermMem
    };
  }

  /**
   * Clear all memory (for testing or reset).
   */
  clearAll(): void {
    this.workingMemory.clear();
    this.sessionMemory.clear();
    this.recognitionMemory.clear();
    this.knowledgeMemory.clear();
    this.longTermMemory.clear();
    logger.info("All memory cleared");
  }

  /**
   * Clear session memory only.
   */
  clearSession(sessionId: string): void {
    this.sessionMemory.delete(sessionId);
    logger.info({ sessionId }, "Session memory cleared");
  }

  /**
   * Get memory statistics.
   */
  getStats(): Record<MemoryType, number> {
    return {
      WORKING: this.workingMemory.size,
      SESSION: this.sessionMemory.size,
      RECOGNITION: this.recognitionMemory.size,
      KNOWLEDGE: this.knowledgeMemory.size,
      LONG_TERM: this.longTermMemory.size
    };
  }

  /**
   * Cleanup expired entries.
   */
  private cleanupExpired<K>(
    store: Map<K, MemoryEntry | SessionMemory>, 
    ttlMs: number,
    isSession = false
  ): void {
    const now = Date.now();
    
    if (isSession) {
      // For sessions, check the startedAt property
      for (const [key, value] of store) {
        if ("startedAt" in value) {
          const session = value as SessionMemory;
          if (now - session.startedAt.getTime() > ttlMs) {
            store.delete(key);
          }
        }
      }
    } else {
      // For regular memory entries
      for (const [key, entry] of store) {
        if ("createdAt" in entry) {
          const memory = entry as MemoryEntry;
          if (now - memory.createdAt.getTime() > ttlMs) {
            store.delete(key);
          }
        }
      }
    }
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();
