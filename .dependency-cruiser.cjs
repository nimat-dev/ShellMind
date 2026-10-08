/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "pure-protocol-core",
      comment: "Rule 1: packages/protocol must not import Node builtins, I/O libraries, or framework code",
      severity: "error",
      from: { path: "^packages/protocol" },
      to: {
        dependencyTypes: ["core"],
        path: [
          "^node:",
          "^(fs|path|net|child_process|os|crypto|http|https|stream|util|events|buffer|tls|dgram)$",
          "node-pty",
          "ws",
          "^react",
          "^expo",
          "@anthropic-ai"
        ]
      }
    },
    {
      name: "no-mobile-to-agent",
      comment: "Rule 2: packages/mobile must not import packages/agent",
      severity: "error",
      from: { path: "^packages/mobile" },
      to: { path: "^packages/agent" }
    },
    {
      name: "no-agent-to-mobile",
      comment: "Rule 2: packages/agent must not import packages/mobile",
      severity: "error",
      from: { path: "^packages/agent" },
      to: { path: "^packages/mobile" }
    },
    {
      name: "agent-core-side-effect-free",
      comment: "Rule 3: packages/agent/src/core must not import I/O or concrete adapters",
      severity: "error",
      from: { path: "^packages/agent/src/core" },
      to: {
        path: [
          "^packages/agent/src/adapters",
          "^node:",
          "^(fs|path|net|child_process|os|crypto|http|https|stream|util|events|buffer|tls|dgram)$",
          "node-pty",
          "ws"
        ]
      }
    }
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "dist", "\\.test\\.ts$"]
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "./tsconfig.base.json"
    }
  }
};
