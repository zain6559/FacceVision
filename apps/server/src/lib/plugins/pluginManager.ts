/**
 * Face Intelligence Platform — Plugin Manager & Lifecycle Engine
 *
 * Manages plugin lifecycle, registers event hooks, and dispatches biometric event payloads.
 */

import { FaceVisionPlugin, PluginEventPayload, PluginHook, PluginManifest } from "./types.js";

export class PluginManager {
  private plugins: Map<string, FaceVisionPlugin> = new Map();

  /**
   * Registers a new plugin with the engine.
   */
  public async registerPlugin(plugin: FaceVisionPlugin): Promise<void> {
    if (this.plugins.has(plugin.manifest.id)) {
      console.warn(`[PluginManager] Plugin ${plugin.manifest.id} already registered. Updating...`);
    }

    if (plugin.onInit) {
      await plugin.onInit();
    }

    this.plugins.set(plugin.manifest.id, plugin);
    console.log(`[PluginManager] ✓ Plugin registered: ${plugin.manifest.name} v${plugin.manifest.version}`);
  }

  /**
   * Dispatches an event payload asynchronously to all subscribed, enabled plugins.
   */
  public async dispatchEvent(payload: PluginEventPayload): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const plugin of this.plugins.values()) {
      if (!plugin.manifest.enabled) continue;
      if (plugin.manifest.hooks.includes(payload.eventName) && plugin.onEvent) {
        promises.push(
          plugin.onEvent(payload).catch(err => {
            console.error(`[PluginManager] Error in plugin ${plugin.manifest.id} handling ${payload.eventName}:`, err);
          })
        );
      }
    }

    await Promise.all(promises);
  }

  /**
   * List all registered plugins and their manifests.
   */
  public getManifests(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(p => p.manifest);
  }

  /**
   * Enable or disable a plugin by ID.
   */
  public togglePlugin(pluginId: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.manifest.enabled = enabled;
    return true;
  }
}

export const pluginManager = new PluginManager();
