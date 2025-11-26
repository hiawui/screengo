// i18n.ts - Internationalization utility
import { storage, STORAGE_KEYS } from './storage';

export type SupportedLanguage = 'en' | 'zh_CN' | 'zh_TW' | 'es';

interface TranslationMessage {
  message: string;
  description?: string;
  placeholders?: Record<string, any>;
}

class I18n {
  private currentLang: SupportedLanguage;
  private messages: Record<string, TranslationMessage> = {};

  constructor() {
    this.currentLang = this.detectLanguage();
  }

  private detectLanguage(): SupportedLanguage {
    // Get system language
    const systemLang = chrome.i18n.getUILanguage();
    
    // Map system language to supported languages
    const langMap: Record<string, SupportedLanguage> = {
      'en': 'en',
      'en-US': 'en',
      'en-GB': 'en',
      'zh-CN': 'zh_CN',
      'zh': 'zh_CN',
      'zh-TW': 'zh_TW',
      'es': 'es',
      'es-ES': 'es',
      'es-MX': 'es',
      'es-AR': 'es',
      'es-CO': 'es',
      'es-CL': 'es'
    };

    // Try exact match
    if (langMap[systemLang]) {
      return langMap[systemLang];
    }

    // Try language code match (e.g., zh-CN -> zh)
    const langCode = systemLang.split('-')[0];
    if (langMap[langCode]) {
      return langMap[langCode];
    }

    // Default to English
    return 'en';
  }

  /**
   * Load messages from _locales directory manually
   * This is required because chrome.i18n.getMessage always returns messages
   * for the browser's current locale, not the one we want to switch to dynamically.
   */
  private async loadMessages(lang: SupportedLanguage): Promise<void> {
    try {
      const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
      const response = await fetch(url);
      this.messages = await response.json();
    } catch (e) {
      console.error(`Failed to load messages for ${lang}:`, e);
      this.messages = {};
    }
  }

  t(key: string, substitutions?: string | string[]): string {
    // 1. Try to use manually loaded messages (supports dynamic language switching)
    if (this.messages[key]) {
      let message = this.messages[key].message;
      // Basic substitution support if needed in the future
      if (substitutions) {
        const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
        subs.forEach((sub, i) => {
          message = message.replace(new RegExp(`\\$${i + 1}`, 'g'), sub);
        });
      }
      return message;
    }

    // 2. Fallback to Chrome's i18n API (uses browser locale)
    try {
      return chrome.i18n.getMessage(key, substitutions) || key;
    } catch (e) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  async setLanguage(lang: SupportedLanguage): Promise<void> {
    if (['en', 'zh_CN', 'zh_TW', 'es'].includes(lang)) {
      this.currentLang = lang;
      
      // Load messages for the new language
      await this.loadMessages(lang);

      // Save user preference to storage
      try {
        await storage.set({ [STORAGE_KEYS.LANGUAGE]: lang });
      } catch (error) {
        console.warn('Failed to save language preference:', error);
      }
      
      // Trigger language change event
      this.updateUI();
    }
  }

  getLanguage(): SupportedLanguage {
    return this.currentLang;
  }

  async init(): Promise<void> {
    // Check if user has saved language preference
    let targetLang = this.currentLang;
    try {
      const lang = await storage.get(STORAGE_KEYS.LANGUAGE);
      if (lang && ['en', 'zh_CN', 'zh_TW', 'es'].includes(lang)) {
        targetLang = lang;
      }
    } catch (error) {
      console.warn('Failed to load language preference:', error);
    }

    // Update current lang and load messages
    this.currentLang = targetLang;
    await this.loadMessages(targetLang);
    
    this.updateUI();
  }

  private updateUI(): void {
    // Dispatch custom event to notify UI update
    window.dispatchEvent(new CustomEvent('i18n:languageChanged', {
      detail: { language: this.currentLang }
    }));
  }
}

// Create global instance
export const i18n = new I18n();

// Export convenience function
export function t(key: string, substitutions?: string | string[]): string {
  return i18n.t(key, substitutions);
}
