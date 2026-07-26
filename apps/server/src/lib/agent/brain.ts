/**
 * FaceVision — Agent System
 * 
 * Goal-driven biometric intelligence agent.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    BiometricAgent                               │
 * ├─────────────────────────────────────────────────────────────────┤
 * │   Request ──► [Goal Engine] ──► [Planner] ──► [Executor]     │
 * │                                                                 │
 * │   Memory: Working │ Session │ Recognition │ Knowledge │ Long   │
 * │   Learning: Feedback → Examples → Training → Updates             │
 * │   Explainability: Evidence → Confidence → Reasoning → Audit       │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * @deprecated Use BiometricAgent from './core/runtime' instead
 */

// Re-export the new agent system for backward compatibility
export { BiometricAgent, createAgent } from "./core/runtime/index.js";
export type { AgentConfig } from "./core/runtime/index.js";

// Re-export core components
export * from "./core/index.js";

// Legacy exports for backward compatibility
export interface BrainModelConfig {
  mode: "EXTERNAL_API" | "LOCAL_GGUF";
  apiEndpoint?: string;
  apiKey?: string;
  modelId?: string;
  ggufPath?: string;
  nGpuLayers?: number;
  cpuThreads?: number;
  contextSize?: number;
  temperature?: number;
}

/**
 * @deprecated Use BiometricAgent instead
 */
export class AgentBrain {
  private activeConfig: BrainModelConfig = {
    mode: "EXTERNAL_API",
    apiEndpoint: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini",
    nGpuLayers: 32,
    cpuThreads: 4,
    contextSize: 4096,
    temperature: 0.2
  };

  public async configureBrain(config: Partial<BrainModelConfig>): Promise<void> {
    this.activeConfig = { ...this.activeConfig, ...config };
    console.log(`[Agent Brain] Configured. Mode: ${this.activeConfig.mode} | Model: ${this.activeConfig.modelId}`);
  }

  public async executeInference(prompt: string, imageBase64?: string): Promise<string> {
    console.log(`[Agent Brain] Executing inference for prompt: "${prompt.slice(0, 50)}..."`);
    return JSON.stringify({
      decision: "PLANNED",
      confidence: 0.9,
      reasoning: "Legacy mode - use BiometricAgent for full capabilities"
    });
  }

  public getActiveConfig(): BrainModelConfig {
    return { ...this.activeConfig };
  }
}

export const agentBrain = new AgentBrain();
