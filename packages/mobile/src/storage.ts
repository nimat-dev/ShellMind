export interface ISecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export class MemorySecureStorage implements ISecureStorage {
  private store = new Map<string, string>();

  public async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  public async deleteItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class ExpoSecureStoreAdapter implements ISecureStorage {
  private fallback = new MemorySecureStorage();
  private nativeStore: typeof import("expo-secure-store") | null = null;
  private initialized = false;

  private async getNativeStore(): Promise<typeof import("expo-secure-store") | null> {
    if (this.initialized) return this.nativeStore;
    try {
      this.nativeStore = await import("expo-secure-store");
    } catch {
      this.nativeStore = null;
    }
    this.initialized = true;
    return this.nativeStore;
  }

  public async getItem(key: string): Promise<string | null> {
    const store = await this.getNativeStore();
    if (store && typeof store.getItemAsync === "function") {
      try {
        return await store.getItemAsync(key);
      } catch {
        return this.fallback.getItem(key);
      }
    }
    return this.fallback.getItem(key);
  }

  public async setItem(key: string, value: string): Promise<void> {
    const store = await this.getNativeStore();
    if (store && typeof store.setItemAsync === "function") {
      try {
        await store.setItemAsync(key, value);
        return;
      } catch {
        await this.fallback.setItem(key, value);
        return;
      }
    }
    await this.fallback.setItem(key, value);
  }

  public async deleteItem(key: string): Promise<void> {
    const store = await this.getNativeStore();
    if (store && typeof store.deleteItemAsync === "function") {
      try {
        await store.deleteItemAsync(key);
        return;
      } catch {
        await this.fallback.deleteItem(key);
        return;
      }
    }
    await this.fallback.deleteItem(key);
  }
}
