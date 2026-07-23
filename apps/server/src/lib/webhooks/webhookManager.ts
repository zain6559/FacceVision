/**
 * Face Intelligence Platform — Webhook Management Engine
 *
 * Manages webhook endpoints, HMAC-SHA256 signature signing, and event delivery.
 */

import { createHmac, randomBytes } from "crypto";
import { PluginHook, WebhookSubscription } from "../plugins/types.js";

class WebhookManager {
  private subscriptions: Map<string, WebhookSubscription> = new Map();

  constructor() {
    // Add default demonstration webhook
    this.createSubscription({
      name: "Security SOC Webhook",
      url: "http://localhost:8080/api/webhooks/test-receiver",
      subscribedEvents: ["onFaceRecognized", "onAnomalyDetected"],
    });
  }

  public createSubscription(params: {
    name: string;
    url: string;
    subscribedEvents: PluginHook[];
  }): WebhookSubscription {
    const id = "wh_" + randomBytes(12).toString("hex");
    const secret = "whsec_" + randomBytes(24).toString("hex");

    const sub: WebhookSubscription = {
      id,
      name: params.name,
      url: params.url,
      secret,
      subscribedEvents: params.subscribedEvents,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(id, sub);
    console.log(`[WebhookManager] Registered webhook: ${sub.name} -> ${sub.url}`);
    return sub;
  }

  public getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  public deleteSubscription(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  /**
   * Signs and dispatches payload to matching webhook URLs.
   */
  public async dispatchWebhookEvent(eventName: PluginHook, data: Record<string, any>): Promise<void> {
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      data,
    };
    const bodyStr = JSON.stringify(payload);

    for (const sub of this.subscriptions.values()) {
      if (!sub.enabled || !sub.subscribedEvents.includes(eventName)) continue;

      const signature = createHmac("sha256", sub.secret).update(bodyStr).digest("hex");

      fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FaceVision-Signature": signature,
          "X-FaceVision-Event": eventName,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(5000),
      }).catch(err => {
        console.warn(`[WebhookManager] Webhook delivery failed to ${sub.url}: ${err.message}`);
      });
    }
  }
}

export const webhookManager = new WebhookManager();
