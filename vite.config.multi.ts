import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Common plugins
const reactPlugin = react();
const copyPlugin = viteStaticCopy({
  targets: [
    { src: 'manifest.json', dest: '.' },
    { src: '_locales', dest: '.' },
    { src: 'icons/*.png', dest: 'icons' },
    { src: 'src/styles/content.css', dest: 'assets' },
    { src: 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', dest: 'assets' },
    { src: 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', dest: 'assets' }
  ]
});

// Custom plugin to move preview.html to root of dist
const flattenOutputPlugin = () => {
  return {
    name: 'flatten-output',
    closeBundle: async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      try {
        // Move dist/src/preview.html to dist/preview.html
        const srcPath = resolve(__dirname, 'dist/src/preview.html');
        const destPath = resolve(__dirname, 'dist/preview.html');
        
        // Check if source exists before attempting move
        try {
          await fs.access(srcPath);
        } catch {
          return; // Source doesn't exist, nothing to do
        }

        await fs.rename(srcPath, destPath);
        console.log('Moved preview.html to root of dist');
        
        // Clean up empty src directory if it exists and is empty
        // (This is optional, just for cleanliness)
        try {
            await fs.rm(resolve(__dirname, 'dist/src'), { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
      } catch (e) {
        console.log('Note: Could not move preview.html:', e);
      }
    }
  };
};

// Common config
const sharedConfig = {
  build: {
    emptyOutDir: false,
    sourcemap: false,
    minify: 'esbuild' as const
  }
};

// Background and Preview pages (ES modules)
export const extensionConfig = defineConfig({
  ...sharedConfig,
  plugins: [reactPlugin, copyPlugin, flattenOutputPlugin()], 
  build: {
    ...sharedConfig.build,
    outDir: 'dist',
    emptyOutDir: true, 
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        preview: resolve(__dirname, 'src/preview.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});

// Content script (IIFE)
export const contentConfig = defineConfig({
  ...sharedConfig,
  plugins: [reactPlugin], // NO COPY PLUGIN HERE
  build: {
    ...sharedConfig.build,
    outDir: 'dist',
    emptyOutDir: false, 
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.tsx')
      },
      output: {
        entryFileNames: 'content.js',
        format: 'iife',
        extend: true,
        name: 'ScreenGoContent', // Global variable name for IIFE
        inlineDynamicImports: true // Inline everything into a single file
      }
    }
  }
});
