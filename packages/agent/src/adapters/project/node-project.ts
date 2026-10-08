import * as fs from "node:fs";
import * as path from "node:path";
import type { IProjectManager, ProjectInfo } from "../../core/project.js";

export interface NodeProjectManagerOptions {
  initialCwd?: string;
  scanRoot?: string;
}

export class NodeProjectManager implements IProjectManager {
  private currentCwd: string;
  private scanRoot?: string;

  constructor(options: NodeProjectManagerOptions = {}) {
    this.currentCwd = path.resolve(options.initialCwd ?? process.cwd());
    this.scanRoot = options.scanRoot ? path.resolve(options.scanRoot) : undefined;
  }

  public getCurrentCwd(): string {
    return this.currentCwd;
  }

  public async setCurrentCwd(target: string): Promise<boolean> {
    try {
      const resolved = path.resolve(target);
      const stat = await fs.promises.stat(resolved);
      if (stat.isDirectory()) {
        this.currentCwd = resolved;
        return true;
      }
    } catch {
      // Path does not exist or inaccessible
    }
    return false;
  }

  public async listProjects(): Promise<ProjectInfo[]> {
    const projects: ProjectInfo[] = [
      {
        name: path.basename(this.currentCwd) || this.currentCwd,
        path: this.currentCwd,
      },
    ];

    const searchDir = this.scanRoot ?? path.dirname(this.currentCwd);
    try {
      const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const fullPath = path.join(searchDir, entry.name);
          if (fullPath !== this.currentCwd) {
            projects.push({
              name: entry.name,
              path: fullPath,
            });
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    return projects;
  }
}
