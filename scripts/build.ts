import { build } from 'vite';
import { extensionConfig, contentConfig } from '../vite.config.multi';

(async () => {
  try {
    // Build extension pages (background, preview)
    console.log('Building extension pages...');
    await build(extensionConfig);
    
    // Wait a bit to ensure FS operations settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Build content script
    console.log('Building content script...');
    await build(contentConfig);

    console.log('Build completed successfully');
  } catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
  }
})();
