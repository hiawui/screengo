// background.ts - Background service script, handles screen capture permissions

// Handle extension icon click event
chrome.action.onClicked.addListener((tab) => {
  // Send message to current tab's content script to show control panel
  chrome.tabs.sendMessage(tab.id!, { action: 'showPanel' }, (_response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message:', chrome.runtime.lastError);
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getScreenStream') {
    // Get screen stream
    // Use sources from request, fallback to default if not provided
    const sources = request.sources || ['screen', 'window', 'tab'];
    
    chrome.desktopCapture.chooseDesktopMedia(
      sources,
      sender.tab!,
      (streamId) => {
        if (streamId) {
          sendResponse({ success: true, streamId: streamId });
        } else {
          sendResponse({ success: false, error: 'User cancelled or no stream selected' });
        }
      }
    );
    
    // Return true to indicate async response
    return true;
  }
  
  if (request.action === 'downloadFile') {
    // Download file
    const { blobData, blobType, filename } = request;
    
    // Simplify MIME type for chrome.downloads.download compatibility
    // Remove codec parameters as they can cause issues with data URLs
    // The file content already contains correct codec info
    let simplifiedType = blobType;
    if (blobType.includes(';codecs=')) {
      // Extract base type (e.g., "video/webm;codecs=vp9,opus" -> "video/webm")
      simplifiedType = blobType.split(';')[0];
      console.log(`Simplified MIME type: ${blobType} -> ${simplifiedType}`);
    }
    
    // Create data URL with simplified MIME type (service worker doesn't support URL.createObjectURL)
    const dataUrl = `data:${simplifiedType};base64,${blobData}`;

    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('Download started successfully, ID:', downloadId);
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    
    return true;
  }
});

