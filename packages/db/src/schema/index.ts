// Legacy exports (for backwards compatibility)
export * from "./persons.js";
export * from "./enterprise.js";

// Domain-based schemas (new architecture)
export * from "./domains/identity/index.js";
export * from "./domains/recognition/index.js";
export * from "./domains/learning/index.js";
export * from "./domains/audit/index.js";
