import { AudioOptions, Position } from '../types';
import { SupportedLanguage } from './i18n';

// Define all storage keys
export const STORAGE_KEYS = {
  LANGUAGE: 'language',
  PANEL_POS_MAIN: 'panel_pos_main',
  PANEL_POS_MINI: 'panel_pos_mini',
  AUDIO_OPTS: 'audio_opts',
  SHOW_MINI_PANEL: 'show_mini_panel'
} as const;

// Define schema based on keys
export interface StorageSchema {
  [STORAGE_KEYS.LANGUAGE]?: SupportedLanguage;
  [STORAGE_KEYS.PANEL_POS_MAIN]?: Position;
  [STORAGE_KEYS.PANEL_POS_MINI]?: Position;
  [STORAGE_KEYS.AUDIO_OPTS]?: AudioOptions;
  [STORAGE_KEYS.SHOW_MINI_PANEL]?: boolean;
}

class StorageService {
  /**
   * Get values from storage
   * @param keys Keys to retrieve. If string, returns single value. If array, returns object with values. If null/undefined, returns all.
   */
  async get<K extends keyof StorageSchema>(keys: K): Promise<StorageSchema[K]>;
  async get<K extends keyof StorageSchema>(keys: K[]): Promise<Pick<StorageSchema, K>>;
  async get(): Promise<StorageSchema>;
  async get(keys?: keyof StorageSchema | (keyof StorageSchema)[]): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys || null, (result) => {
        if (typeof keys === 'string') {
          resolve(result[keys]);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Set values in storage
   * @param items Object containing key-value pairs to store
   */
  async set(items: Partial<StorageSchema>): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove values from storage
   * @param keys Key or array of keys to remove
   */
  async remove(keys: keyof StorageSchema | (keyof StorageSchema)[]): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all data from storage
   */
  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

export const storage = new StorageService();
