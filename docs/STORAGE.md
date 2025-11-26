# Storage Schema

This document describes the data structure used in Chrome's `local` storage.

## Schema Definition

All storage keys and their corresponding value types are defined in `src/services/storage.ts`.

### Configuration Items

We use constants defined in `STORAGE_KEYS` to ensure consistency.

| Key Constant | Raw Key Value | Type | Description |
|--------------|---------------|------|-------------|
| `LANGUAGE` | `'language'` | `'en' \| 'zh_CN' \| 'zh_TW' \| 'es'` | User's preferred language setting |
| `PANEL_POS_MAIN` | `'panel_pos_main'` | `Position` | Coordinates of the main control panel |
| `PANEL_POS_MINI` | `'panel_pos_mini'` | `Position` | Coordinates of the mini control panel |
| `FORMAT` | `'format'` | `'webm' \| 'mp4'` | Default recording format |
| `AUDIO_OPTS` | `'audio_opts'` | `AudioOptions` | Default audio recording settings |

## Storage Service

We provide a unified `StorageService` to handle all storage operations.

### Usage

```typescript
import { storage, STORAGE_KEYS } from './services/storage';

// Get a single value
const format = await storage.get(STORAGE_KEYS.FORMAT);

// Get multiple values
const settings = await storage.get([
  STORAGE_KEYS.FORMAT, 
  STORAGE_KEYS.AUDIO_OPTS
]);

// Set values
await storage.set({
  [STORAGE_KEYS.FORMAT]: 'mp4',
  [STORAGE_KEYS.LANGUAGE]: 'zh_CN'
});

// Remove values
await storage.remove(STORAGE_KEYS.FORMAT);
```

### Type Safety

The storage service is fully typed. TypeScript will provide autocompletion for keys and validate value types.
