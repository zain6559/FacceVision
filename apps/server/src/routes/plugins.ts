import { Router } from "express";
import { pluginManager } from "../lib/plugins/pluginManager.js";
import { MARKETPLACE_CATALOG } from "../lib/plugins/marketplace.js";
import { webhookManager } from "../lib/webhooks/webhookManager.js";

const router = Router();

// ─── PLUGINS & MARKETPLACE ───────────────────────────────────────────────────

// GET /api/plugins — List active plugins and marketplace catalog
router.get("/plugins", (req, res) => {
  const activeManifests = pluginManager.getManifests();
  res.json({
    activePlugins: activeManifests,
    marketplaceCatalog: MARKETPLACE_CATALOG,
  });
});

// POST /api/plugins/:id/toggle — Toggle plugin state
router.post("/plugins/:id/toggle", (req, res) => {
  const { enabled } = req.body;
  const success = pluginManager.togglePlugin(req.params.id, !!enabled);
  if (!success) {
    res.status(404).json({ error: "Plugin not found" });
    return;
  }
  res.json({ success: true, pluginId: req.params.id, enabled: !!enabled });
});

// ─── WEBHOOKS MANAGEMENT ─────────────────────────────────────────────────────

// GET /api/webhooks — List webhook subscriptions
router.get("/webhooks", (req, res) => {
  res.json(webhookManager.getSubscriptions());
});

// POST /api/webhooks — Register new webhook subscription
router.post("/webhooks", (req, res) => {
  const { name, url, subscribedEvents = ["onFaceRecognized"] } = req.body;
  if (!name || !url) {
    res.status(400).json({ error: "Name and URL are required" });
    return;
  }

  const sub = webhookManager.createSubscription({ name, url, subscribedEvents });
  res.status(201).json(sub);
});

// DELETE /api/webhooks/:id — Delete webhook
router.delete("/webhooks/:id", (req, res) => {
  const success = webhookManager.deleteSubscription(req.params.id);
  res.json({ success });
});

// POST /api/webhooks/test-receiver — Internal test receiver for demonstration
router.post("/webhooks/test-receiver", (req, res) => {
  console.log("[TestWebhookReceiver] Received webhook payload:", req.body);
  res.json({ status: "RECEIVED" });
});

export default router;
