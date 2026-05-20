// Khởi tạo máy nghe lén API (API Interceptor)
(function() {
  const XHR = XMLHttpRequest.prototype;
  const open = XHR.open;
  const send = XHR.send;

  // Móc vào XHR (Dành cho Angular / hệ thống cũ)
  XHR.open = function(method, url) {
    this._url = url;
    return open.apply(this, arguments);
  };

  XHR.send = function(postData) {
    this.addEventListener('load', function() {
      try {
        if (this.responseType === '' || this.responseType === 'text' || this.responseType === 'json') {
          const responseText = this.responseText;
          if (responseText && (responseText.includes('tenDayDu') || responseText.includes('maBenhNhan') || responseText.includes('hoTen') || responseText.includes('NgaySinh'))) {
            // Gửi dữ liệu thô ra cho Content Script
            window.postMessage({ type: 'API_INTERCEPT', data: responseText, url: this._url }, '*');
          }
        }
      } catch (e) {
        // Bỏ qua lỗi parse
      }
    });
    return send.apply(this, arguments);
  };

  // Móc vào Fetch (Dành cho hệ thống hiện đại)
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const clone = response.clone();
    
    clone.text().then(text => {
      try {
        if (text && (text.includes('tenDayDu') || text.includes('maBenhNhan') || text.includes('hoTen') || text.includes('NgaySinh'))) {
          // Gửi dữ liệu thô ra cho Content Script
          window.postMessage({ type: 'API_INTERCEPT', data: text, url: args[0] }, '*');
        }
      } catch (e) {}
    }).catch(e => {});
    
    return response;
  };
})();
