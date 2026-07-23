/**
 * Face Intelligence Platform — Plugin Architecture & Extension Interface
 *
 * Defines the contract for third-party extensions, webhooks, and Marketplace plugins.
 */

export type PluginHook =
  | "onFaceRecognized"
  | "onFaceEnrolled"
  | "onAuditLog"
  | "onQualityCheckFailed"
  | "onAnomalyDetected";

export interface PluginEventPayload {
  eventName: PluginHook;
  timestamp: string;
  tenantId?: string;
  data: Record<string, any>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: "SECURITY" | "ANALYTICS" | "INTEGRATION" | "AUGMENTATION";
  hooks: PluginHook[];
  enabled: boolean;
  official?: boolean;
}

export interface FaceVisionPlugin {
  manifest: PluginManifest;
  onInit?(): Promise<void>;
  onEvent?(payload: PluginEventPayload): Promise<void>;
  onDestroy?(): Promise<void>;
}

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  secret: string;             // HMAC-SHA256 signing secret
  subscribedEvents: PluginHook[];
  enabled: boolean;
  createdAt: string;
}
