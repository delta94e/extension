// Download page script - creates blob and triggers download via chrome.downloads API
async function doDownload() {
  const status = document.getElementById('status');

  try {
    const result = await chrome.storage.local.get(['downloadData', 'downloadFileName']);
    const { downloadData, downloadFileName } = result;

    if (!downloadData) {
      status.textContent = 'Không có dữ liệu để tải.';
      return;
    }

    status.textContent = 'Đang chuẩn bị file...';

    // Convert base64 to binary
    const byteChars = atob(downloadData);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }

    // Create blob with correct MIME type
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const blobUrl = URL.createObjectURL(blob);
    const fileName = downloadFileName || 'Phieu_KSK_NCT.docx';

    // Use chrome.downloads API with blob URL - this preserves filename
    chrome.downloads.download({
      url: blobUrl,
      filename: fileName,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        status.textContent = '❌ Lỗi: ' + chrome.runtime.lastError.message;
        console.error(chrome.runtime.lastError);
        return;
      }

      status.textContent = '✅ Đã tải file: ' + fileName;

      // Cleanup
      chrome.storage.local.remove(['downloadData', 'downloadFileName']);
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        window.close();
      }, 2000);
    });

  } catch (err) {
    status.textContent = '❌ Lỗi: ' + err.message;
    console.error('Download error:', err);
  }
}

doDownload();
