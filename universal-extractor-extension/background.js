chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadDocx') {
    chrome.downloads.download({
      url: request.blobUrl,
      filename: request.fileName,
      saveAs: true // Let the user choose where to save
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true; // Keep message channel open for async callback
  }
});
