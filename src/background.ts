// background.ts - Background service script, handles screen capture permissions

// Store preview data in memory
let previewData: { data: string; type: string; filename: string; fps?: number } | null = null;

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

  if (request.action === 'getTabStreamId') {
    chrome.tabCapture.getMediaStreamId({ consumerTabId: sender.tab!.id }, (streamId) => {
      if (streamId) {
        sendResponse({ success: true, streamId: streamId });
      } else {
        sendResponse({ success: false, error: 'Failed to get tab media stream' });
      }
    });
    return true;
  }
  
  if (request.action === 'openPreview') {
    const { blobData, blobType, filename, fps } = request;
    
    // Store data in memory
    previewData = {
      data: blobData,
      type: blobType,
      filename: filename,
      fps: fps
    };

    // Open preview page
    chrome.tabs.create({ url: 'preview.html' }, () => {
        if (chrome.runtime.lastError) {
             console.error('Failed to open preview tab:', chrome.runtime.lastError);
             sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
             sendResponse({ success: true });
        }
    });
    return true;
  }

  if (request.action === 'getPreviewData') {
    if (previewData) {
        sendResponse({ success: true, ...previewData });
    } else {
        sendResponse({ success: false, error: 'No preview data found' });
    }
    return true;
  }

});
