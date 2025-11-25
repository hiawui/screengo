// i18n.ts - Internationalization utility

type SupportedLanguage = 'en' | 'zh_CN' | 'zh_TW' | 'es';

class I18n {
  private currentLang: SupportedLanguage;

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

  t(key: string, substitutions?: string | string[]): string {
    // Use Chrome's i18n API
    try {
      return chrome.i18n.getMessage(key, substitutions) || key;
    } catch (e) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  setLanguage(lang: SupportedLanguage): void {
    if (['en', 'zh_CN', 'zh_TW', 'es'].includes(lang)) {
      this.currentLang = lang;
      // Save user preference to chrome.storage (shared across domains)
      try {
        chrome.storage.local.set({ preferredLanguage: lang });
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
    // Check if user has saved language preference (using chrome.storage, shared across domains)
    try {
      const result = await chrome.storage.local.get(['preferredLanguage']);
      if (result.preferredLanguage && ['en', 'zh_CN', 'zh_TW', 'es'].includes(result.preferredLanguage)) {
        this.currentLang = result.preferredLanguage as SupportedLanguage;
      }
    } catch (error) {
      console.warn('Failed to load language preference:', error);
    }
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

