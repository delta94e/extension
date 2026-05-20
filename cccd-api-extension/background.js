// Background Service Worker - handles DOCX downloads
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadDocx') {
    chrome.downloads.download({
      url: message.blobUrl,
      filename: message.fileName,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true; // async response
  }
});
