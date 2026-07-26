/**
 * FaceVision — Data Lifecycle Manager
 * 
 * Manages data through its lifecycle:
 * - Hot Storage: Active, frequently accessed
 * - Warm Storage: Less active, archived embeddings
 * - Cold Storage: Rarely accessed, compressed data
 * - Archive: Long-term retention, very slow access
 */

import { logger } from "../../../logger.js";

/**
 * Storage tiers.
 */
export type StorageTier = "HOT" | "WARM" | "COLD" | "ARCHIVE";

/**
 * Lifecycle policies.
 */
export interface LifecyclePolicy {
  tier: StorageTier;
  retentionDays: number;
  compressionEnabled: boolean;
  accessFrequency: "HIGH" | "MEDIUM" | "LOW" | "RARE";
}

/**
 * Transition rules.
 */
export interface TransitionRule {
  from: StorageTier;
  to: StorageTier;
  condition: (data: DataMetadata) => boolean;
  priority: number;
}

/**
 * Data metadata for lifecycle decisions.
 */
export interface DataMetadata {
  entityType: "FACE_SAMPLE" | "EMBEDDING" | "RECOGNITION_LOG";
  entityId: string;
  age: number; // days since creation
  accessCount: number;
  lastAccessedAt: Date;
  qualityScore: number;
  storageTier: StorageTier;
  isPrimary: boolean;
  tenantId: string;
}

/**
 * Data Lifecycle Manager.
 */
export class DataLifecycleManager {
  private policies: Map<string, LifecyclePolicy> = new Map();
  private transitionRules: TransitionRule[] = [];
  
  // Thresholds
  private readonly HOT_TO_WARM_DAYS = 30;
  private readonly WARM_TO_COLD_DAYS = 180;
  private readonly COLD_TO_ARCHIVE_DAYS = 365;
  
  // Access frequency thresholds
  private readonly HIGH_ACCESS_THRESHOLD = 100; // accesses per month
  private readonly MEDIUM_ACCESS_THRESHOLD = 10;

  constructor() {
    this.initializeDefaultPolicies();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default lifecycle policies.
   */
  private initializeDefaultPolicies(): void {
    this.policies.set("FACE_SAMPLE", {
      tier: "HOT",
      retentionDays: 365,
      compressionEnabled: false,
      accessFrequency: "HIGH"
    });
    
    this.policies.set("EMBEDDING", {
      tier: "HOT",
      retentionDays: 730, // 2 years
      compressionEnabled: true,
      accessFrequency: "HIGH"
    });
    
    this.policies.set("RECOGNITION_LOG", {
      tier: "HOT",
      retentionDays: 90,
      compressionEnabled: true,
      accessFrequency: "MEDIUM"
    });
    
    this.policies.set("AUDIT_LOG", {
      tier: "COLD",
      retentionDays: 2555, // 7 years for compliance
      compressionEnabled: true,
      accessFrequency: "RARE"
    });
  }

  /**
   * Initialize default transition rules.
   */
  private initializeDefaultRules(): void {
    // HOT → WARM: After 30 days or low access
    this.addTransitionRule({
      from: "HOT",
      to: "WARM",
      condition: (data) => data.age > this.HOT_TO_WARM_DAYS || 
        (data.accessCount < this.MEDIUM_ACCESS_THRESHOLD && data.age > 7),
      priority: 1
    });
    
    // WARM → COLD: After 180 days or rare access
    this.addTransitionRule({
      from: "WARM",
      to: "COLD",
      condition: (data) => data.age > this.WARM_TO_COLD_DAYS || 
        data.accessCount < 5,
      priority: 2
    });
    
    // COLD → ARCHIVE: After 1 year
    this.addTransitionRule({
      from: "COLD",
      to: "ARCHIVE",
      condition: (data) => data.age > this.COLD_TO_ARCHIVE_DAYS,
      priority: 3
    });
    
    // WARM → HOT: High access brings back to hot
    this.addTransitionRule({
      from: "WARM",
      to: "HOT",
      condition: (data) => data.accessCount > this.HIGH_ACCESS_THRESHOLD,
      priority: 1
    });
    
    // COLD → WARM: Moderate access
    this.addTransitionRule({
      from: "COLD",
      to: "WARM",
      condition: (data) => data.accessCount > this.MEDIUM_ACCESS_THRESHOLD,
      priority: 2
    });
  }

  /**
   * Add a transition rule.
   */
  addTransitionRule(rule: TransitionRule): void {
    this.transitionRules.push(rule);
    this.transitionRules.sort((a, b) => a.priority - b.priority);
    logger.info({ rule: `${rule.from} → ${rule.to}` }, "Transition rule added");
  }

  /**
   * Determine next storage tier for data.
   */
  determineNextTier(metadata: DataMetadata): StorageTier {
    // Don't transition primary embeddings
    if (metadata.isPrimary && metadata.entityType === "EMBEDDING") {
      return metadata.storageTier;
    }
    
    // Check rules in priority order
    for (const rule of this.transitionRules) {
      if (rule.from === metadata.storageTier && rule.condition(metadata)) {
        logger.debug({ 
          entityId: metadata.entityId, 
          from: rule.from, 
          to: rule.to 
        }, "Tier transition determined");
        
        return rule.to;
      }
    }
    
    return metadata.storageTier;
  }

  /**
   * Check if data should be deleted (beyond retention).
   */
  shouldDelete(metadata: DataMetadata): boolean {
    const policy = this.policies.get(metadata.entityType);
    if (!policy) return false;
    
    return metadata.age > policy.retentionDays;
  }

  /**
   * Get retention policy for entity type.
   */
  getRetentionPolicy(entityType: string): LifecyclePolicy | undefined {
    return this.policies.get(entityType);
  }

  /**
   * Update retention policy.
   */
  updateRetentionPolicy(entityType: string, retentionDays: number): void {
    const policy = this.policies.get(entityType);
    if (policy) {
      policy.retentionDays = retentionDays;
      logger.info({ entityType, retentionDays }, "Retention policy updated");
    }
  }

  /**
   * Get storage tier statistics.
   */
  getStats(): {
    policies: Record<string, LifecyclePolicy>;
    ruleCount: number;
  } {
    return {
      policies: Object.fromEntries(this.policies),
      ruleCount: this.transitionRules.length
    };
  }

  /**
   * Estimate storage cost savings from tiering.
   */
  estimateCostSavings(
    hotCount: number,
    warmCount: number,
    coldCount: number,
    archiveCount: number
  ): {
    monthlySavings: number;
    hotCost: number;
    warmCost: number;
    coldCost: number;
    archiveCost: number;
  } {
    // Relative costs per 1000 records/month (arbitrary units)
    const costs = {
      HOT: 1.0,
      WARM: 0.4,
      COLD: 0.1,
      ARCHIVE: 0.02
    };
    
    const totalHot = hotCount + warmCount * 0.4 + coldCount * 0.1 + archiveCount * 0.02;
    const currentCost = (hotCount + warmCount + coldCount + archiveCount) * costs.HOT;
    const tieredCost = totalHot;
    
    return {
      monthlySavings: currentCost - tieredCost,
      hotCost: hotCount * costs.HOT,
      warmCost: warmCount * costs.WARM,
      coldCost: coldCount * costs.COLD,
      archiveCost: archiveCount * costs.ARCHIVE
    };
  }
}

// Singleton instance
export const dataLifecycleManager = new DataLifecycleManager();
