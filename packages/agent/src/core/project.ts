export interface ProjectInfo {
  name: string;
  path: string;
}

export interface IProjectManager {
  /**
   * Returns the currently active working directory.
   */
  getCurrentCwd(): string;

  /**
   * Switches the active working directory if valid.
   * Returns true on success, false if the directory is invalid or inaccessible.
   */
  setCurrentCwd(cwd: string): Promise<boolean>;

  /**
   * Lists available candidate project directories.
   */
  listProjects(): Promise<ProjectInfo[]>;
}
