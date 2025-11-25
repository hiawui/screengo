// content.tsx - Content script entry point

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ControlPanel } from './components/ControlPanel';
// CSS is injected via manifest.json content_scripts.css field

// Wait for DOM to load
function init() {
  // Check if already exists
  if (document.getElementById('screengo-root')) {
    return;
  }

  // Create root container
  const root = document.createElement('div');
  root.id = 'screengo-root';
  document.body.appendChild(root);

  // Render React component
  const reactRoot = createRoot(root);
  reactRoot.render(React.createElement(ControlPanel));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
