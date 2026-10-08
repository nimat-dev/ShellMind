import React from "react";
import { DefaultRenderer, type ToolRendererProps } from "./DefaultRenderer.js";
import { BashRenderer } from "./BashRenderer.js";
import { FileRenderer } from "./FileRenderer.js";
import { SearchRenderer } from "./SearchRenderer.js";

export type { ToolRendererProps };
export type ToolRendererComponent = React.FC<ToolRendererProps>;

const registry = new Map<string, ToolRendererComponent>();

// Register standard tools
export function registerDefaultRenderers(): void {
  registry.set("bash", BashRenderer);
  registry.set("terminal", BashRenderer);

  registry.set("read", FileRenderer);
  registry.set("write", FileRenderer);
  registry.set("edit", FileRenderer);
  registry.set("str_replace_editor", FileRenderer);
  registry.set("view", FileRenderer);

  registry.set("globtool", SearchRenderer);
  registry.set("greptool", SearchRenderer);
  registry.set("glob", SearchRenderer);
  registry.set("grep", SearchRenderer);
}

// Initialize default mappings
registerDefaultRenderers();

export function registerToolRenderer(toolName: string, component: ToolRendererComponent): void {
  registry.set(toolName.toLowerCase(), component);
}

export function getToolRenderer(toolName: string): ToolRendererComponent {
  const normalized = toolName.toLowerCase();
  return registry.get(normalized) ?? DefaultRenderer;
}

export function clearToolRenderers(): void {
  registry.clear();
  registerDefaultRenderers();
}
