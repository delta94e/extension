import { authenticate } from './libs/release.js';

// CCCD Extractor - Popup Logic
// Handles data extraction from web page and DOCX generation
// Supports: Section A (Thông tin hành chính) + Section C (Khám thực thể - Chỉ số sinh tồn)

let extractedData = null;
let docxKey = null;

// Authenticated session state
let isAuthenticated = false;

async function initPopup() {
  const loginScreen = document.getElementById('loginScreen');
  const mainScreen = document.getElementById('mainScreen');
  const btnLogin = document.getElementById('btnLogin');
  const authPassword = document.getElementById('authPassword');
  const loginError = document.getElementById('loginError');

  // Hardcoded SHA-256 hash for "1905@DEV"
  const CORRECT_HASH = 'c8a9417509bd26a498bf48ca05efff6040cc7c8458dcca5a9d23fc78979deae1';

  // Check permanent storage for auth state
  const storageResult = await chrome.storage.local.get(['is_permanently_authenticated', 'docx_key']);
  if (storageResult.is_permanently_authenticated && storageResult.docx_key) {
    isAuthenticated = true;
    docxKey = storageResult.docx_key;
    loginScreen.style.display = 'none';
    mainScreen.style.display = 'block';
  } else {
    loginScreen.style.display = 'flex';
    mainScreen.style.display = 'none';
  }

  async function checkPassword() {
    const pwd = authPassword.value;
    if (!pwd) return;
    
    // Validate via WebAssembly and receive the Decryption Key!
    try {
      const secretKey = authenticate(pwd);
      if (secretKey) {
        isAuthenticated = true;
        docxKey = secretKey;
        // Save permanently on this browser
        await chrome.storage.local.set({ is_permanently_authenticated: true, docx_key: secretKey });
        loginScreen.style.display = 'none';
        mainScreen.style.display = 'block';
        loginError.style.display = 'none';
      } else {
        loginError.style.display = 'block';
        authPassword.value = '';
      }
    } catch (e) {
      console.error("Wasm auth error:", e);
      loginError.style.display = 'block';
    }
  }

  btnLogin.addEventListener('click', checkPassword);
  authPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPassword();
  });

  // Main UI events
  const btnExtract = document.getElementById('btnExtract');
  const btnExport = document.getElementById('btnExport');

  btnExtract.addEventListener('click', handleExtract);
  btnExport.addEventListener('click', handleExport);
}

initPopup();

// PDF.js configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdfjs/pdf.worker.min.js';

// ============================
// EXTRACT DATA VIA HEADLESS PDF
// ============================
async function handleExtract() {
  setStatus('loading', 'Đang tạo PDF ngầm từ trang web...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('Không tìm thấy tab đang mở');

    // 1. Attach Debugger
    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId: tab.id }, '1.3', () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });

    // 2. Generate PDF via Page.printToPDF
    const pdfResult = await new Promise((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId: tab.id }, 'Page.printToPDF', {
        landscape: false,
        displayHeaderFooter: false,
        printBackground: true
      }, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });

    // 3. Detach Debugger immediately to hide the warning bar
    chrome.debugger.detach({ tabId: tab.id });

    if (!pdfResult || !pdfResult.data) throw new Error('Không thể tạo PDF từ trang web');

    setStatus('loading', 'Đang phân rã dữ liệu chữ từ PDF...');
    
    // 4. Parse PDF using pdf.js
    const pdfData = atob(pdfResult.data);
    const pdfArray = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
      pdfArray[i] = pdfData.charCodeAt(i);
    }

    const pdfDocument = await pdfjsLib.getDocument({ data: pdfArray }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map(item => item.str);
      fullText += pageStrings.join(' ') + '\n';
    }

    console.log("PDF Raw Text Extract:", fullText);

    // 5. Parse Text into Data Object
    extractedData = parseTextToData(fullText);
    
    displayData(extractedData);
    setStatus('success', `Đã bóc tách PDF thành công`);
    document.getElementById('btnExport').disabled = false;

  } catch (error) {
    console.error('Extract error:', error);
    setStatus('error', 'Lỗi: ' + error.message);
  }
}

function parseTextToData(text) {
  // Chuẩn hoá khoảng trắng
  const normalized = text.replace(/\s+/g, ' ');
  
  // Hàm regex tìm kiếm giá trị sau một nhãn nhất định
  function getValueAfter(label, endTokens = []) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Tìm cụm từ giữa Label và các Token kết thúc (hoặc tối đa 30 ký tự)
    const endTokensRegex = endTokens.length > 0 ? `(?:${endTokens.join('|')})` : '.*';
    const regex = new RegExp(`${escapedLabel}\\s*[:\\-]?\\s*(.*?)\\s*${endTokensRegex}`, 'i');
    const match = normalized.match(regex);
    if (match && match[1]) {
        // Cắt bỏ nếu lấy quá dài (tránh vơ đét cả trang)
        let val = match[1].trim();
        if (val.length > 50) val = val.substring(0, 50).trim();
        return val;
    }
    return '';
  }

  const data = {};
  
  // Các rules này phụ thuộc vào cách nội dung PDF bị ghép lại thành 1 dòng.
  // Có thể cần tinh chỉnh tuỳ thuộc vào hiển thị thật của bệnh viện.
  data.tenDayDu = getValueAfter('Họ và tên', ['Giới tính', 'Ngày sinh', 'Năm sinh', 'Điện thoại']);
  data.gioiTinh = getValueAfter('Giới tính', ['Ngày sinh', 'Năm sinh', 'Điện thoại', 'Dân tộc']);
  data.ngaySinh = getValueAfter('Ngày sinh', ['Năm sinh', 'Điện thoại', 'Dân tộc', 'Tuổi']);
  data.namSinh = getValueAfter('Năm sinh', ['Điện thoại', 'Dân tộc', 'Tuổi']);
  data.dienThoaiDiDong = getValueAfter('Điện thoại', ['CMND', 'CCCD', 'Số nhà', 'Mã']);
  data.cmnd = getValueAfter('CCCD', ['Ngày cấp', 'Nơi cấp', 'Dân tộc']) || getValueAfter('CMND', ['Ngày cấp', 'Nơi cấp', 'Dân tộc']);
  data.danToc = getValueAfter('Dân tộc', ['Quốc tịch', 'Tôn giáo', 'Nghề nghiệp']);
  data.quocTich = getValueAfter('Quốc tịch', ['Dân tộc', 'Địa chỉ', 'Nghề nghiệp']);
  data.soNha = getValueAfter('Số nhà', ['Xã', 'Phường', 'Quận', 'Huyện', 'Tỉnh', 'Thành phố']);
  data.xaPhuong = getValueAfter('Xã', ['Huyện', 'Quận', 'Tỉnh']) || getValueAfter('Phường', ['Huyện', 'Quận', 'Tỉnh']);
  data.tinhTP = getValueAfter('Tỉnh', ['Quốc gia', 'Thẻ', 'Nghề nghiệp']) || getValueAfter('Thành phố', ['Quốc gia', 'Thẻ', 'Nghề nghiệp']);
  data.soThe = getValueAfter('Thẻ BHYT', ['Giá trị', 'Nơi', 'Nghề nghiệp']) || getValueAfter('Số thẻ BHYT', ['Giá trị']);
  data.ngheNghiep = getValueAfter('Nghề nghiệp', ['Người liên hệ', 'Người nhà', 'Nơi làm việc']);
  data.tenNguoiThan = getValueAfter('Người liên hệ', ['Điện thoại', 'Mối quan hệ']);

  return data;
}

// ============================
// DISPLAY EXTRACTED DATA
// ============================
function displayData(data) {
  // Section A
  document.getElementById('dataSection').style.display = 'block';
  setFieldValue('val_tenDayDu', data.tenDayDu);
  setFieldValue('val_gioiTinh', data.gioiTinh);
  const dateDisplay = data.ngaySinh || [data.thangSinh, data.namSinh].filter(Boolean).join('/');
  setFieldValue('val_ngaySinh', dateDisplay);
  setFieldValue('val_namSinh', data.namSinh);
  setFieldValue('val_cmnd', data.cmnd);
  setFieldValue('val_danToc', data.danToc);
  setFieldValue('val_quocTich', data.quocTich);
  setFieldValue('val_soNha', data.soNha);
  setFieldValue('val_xaPhuong', data.xaPhuong);
  setFieldValue('val_tinhTP', data.tinhTP);
  setFieldValue('val_dienThoaiDiDong', data.dienThoaiDiDong);
  setFieldValue('val_soThe', data.soThe);
  setFieldValue('val_ngheNghiep', data.ngheNghiep);

}

function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value || '—';
    el.style.color = value ? '#e8e8f0' : '#5a5a78';
  }
}

function countFilledFields(data) {
  return Object.values(data).filter(v => v && v.toString().trim()).length;
}

// ============================
// EXPORT DOCX
// ============================
async function handleExport() {
  if (!extractedData) {
    setStatus('error', 'Chưa có dữ liệu để xuất');
    return;
  }

  setStatus('loading', 'Đang tạo file DOCX...');

  try {
    if (!docxKey) {
      throw new Error('Không tìm thấy Khoá Giải Mã từ hệ thống bảo mật.');
    }

    // Tải file bị mã hoá (.enc)
    const templateUrl = chrome.runtime.getURL('template.enc');
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error('Không thể tải file template.enc bị mã hoá');
    }

    const encryptedBuffer = await response.arrayBuffer();
    
    // Giải mã bằng XOR Cipher trong bộ nhớ RAM
    const uint8View = new Uint8Array(encryptedBuffer);
    const keyBytes = new TextEncoder().encode(docxKey);
    for (let i = 0; i < uint8View.length; i++) {
      uint8View[i] ^= keyBytes[i % keyBytes.length];
    }

    let zip;
    try {
      // Đưa dữ liệu đã giải mã vào JSZip
      zip = await JSZip.loadAsync(uint8View.buffer);
    } catch (zipError) {
      // Nếu giải mã thất bại (do dùng sai key hoặc key cũ bị kẹt trong storage)
      await chrome.storage.local.clear(); // Xoá storage
      throw new Error('Khóa giải mã không hợp lệ hoặc file bị hỏng. Vui lòng đóng và mở lại tiện ích để đăng nhập lại!');
    }

    const docXml = await zip.file('word/document.xml').async('string');
    const modifiedXml = replaceDocxPlaceholders(docXml, extractedData);
    zip.file('word/document.xml', modifiedXml);

    const patientName = extractedData.tenDayDu || 'benh_nhan';
    const noAccents = patientName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    const safeName = noAccents.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'benh_nhan';
    const fileName = `Phieu_KSK_NCT_${safeName}.docx`;

    // Generate arraybuffer from JSZip
    const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    // Create blob with correct MIME type
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    const blobUrl = URL.createObjectURL(blob);

    // Send blob URL to background service worker (which has chrome.downloads)
    chrome.runtime.sendMessage({
      action: 'downloadDocx',
      blobUrl: blobUrl,
      fileName: fileName
    }, (response) => {
      if (response && response.success) {
        setStatus('success', `Đã xuất file: ${fileName}`);
      } else {
        const errMsg = response?.error || chrome.runtime.lastError?.message || 'Unknown';
        console.error('Download failed:', errMsg);
        setStatus('error', 'Lỗi download: ' + errMsg);
      }
      // Clean up blob after delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    });
  } catch (error) {
    console.error('Export error:', error);
    setStatus('error', 'Lỗi xuất file: ' + error.message);
  }
}

/**
 * Fallback download: open file in new tab so user can save
 */
function fallbackDownload(blobUrl, fileName) {
  chrome.tabs.create({ url: blobUrl }, () => {
    setStatus('success', `File mở trong tab mới. Nhấn Cmd+S để lưu: ${fileName}`);
  });
}

/**
 * Replace placeholders in DOCX XML with extracted data.
 * Uses robust paragraph-based approach to handle split runs.
 */
function replaceDocxPlaceholders(xml, data) {
  let day = '', month = '', year = '';
  if (data.ngaySinh && data.ngaySinh.includes('/')) {
    const parts = data.ngaySinh.split('/');
    day = parts[0] || ''; month = parts[1] || ''; year = parts[2] || '';
  } else {
    year = data.namSinh || ''; month = data.thangSinh || '';
  }

  const isMale = data.gioiTinh && data.gioiTinh.toLowerCase().includes('nam');
  const isFemale = data.gioiTinh && (data.gioiTinh.toLowerCase().includes('nữ'));

  const addressParts = [data.soNha, data.xaPhuong, data.tinhTP].filter(Boolean);
  const fullAddress = addressParts.join(', ');

  // === SECTION A ===
  if (data.tenDayDu) xml = appendValueToLabel(xml, 'Họ và tên', data.tenDayDu);

  if (day || month || year) {
    const dateStr = (day || '..') + '/' + (month || '..') + '/' + (year || '....');
    xml = appendValueToLabel(xml, 'Ngày sinh', dateStr);
  }

  if (isMale || isFemale) {
    // Actual XML: <w:t ...>[ ] </w:t></w:r><w:r ...><w:rPr>...</w:rPr><w:t ...>Nam  </w:t>
    // Simple approach: find "[ ] " before "Nam" or "Nữ" and replace with "[X] "
    const target = isMale ? 'Nam' : 'Nữ';
    const cbIdx = xml.indexOf(target);
    if (cbIdx !== -1) {
      // Search backwards from target for "[ ] "
      const searchArea = xml.substring(Math.max(0, cbIdx - 300), cbIdx);
      const bracketIdx = searchArea.lastIndexOf('[ ]');
      if (bracketIdx !== -1) {
        const absIdx = Math.max(0, cbIdx - 300) + bracketIdx;
        xml = xml.substring(0, absIdx) + '[X]' + xml.substring(absIdx + 3);
      }
    }
  }

  if (data.cmnd) xml = appendValueToLabel(xml, 'CMND/CCCD', data.cmnd);
  if (data.danToc) xml = appendValueToLabel(xml, 'Dân tộc', data.danToc);
  if (data.soThe) {
    const cleanBHYT = data.soThe.replace(/\|/g, '');
    xml = appendValueToLabel(xml, 'thẻ BHYT', cleanBHYT);
  }
  if (fullAddress) xml = appendValueToLabel(xml, 'đường phố', fullAddress);
  
  if (data.xaPhuong) xml = appendValueToLabel(xml, 'Xã/Phường', data.xaPhuong);
  if (data.tinhTP) xml = appendValueToLabel(xml, 'Tỉnh/TP', data.tinhTP);
  
  if (data.dienThoaiDiDong) xml = appendValueToLabel(xml, 'Điện thoại di động', data.dienThoaiDiDong);



  return xml;
}

/**
 * Simply append the value right after the label text in the template.
 * Used when dots have been removed from the template.
 */
function appendValueToLabel(xml, label, value) {
  if (!value) return xml;
  // Escape the label for regex, and allow any whitespace (including non-breaking space)
  let escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  escaped = escaped.replace(/ /g, '\\s+');
  
  // Replace the first occurrence or all occurrences of the label in a <w:t>
  return xml.replace(
    new RegExp('(<w:t[^>]*>)([^<]*?' + escaped + '[^<]*)(<\\/w:t>)', 'g'),
    (match, tStart, text, tEnd) => {
      // Clean trailing spaces and non-breaking spaces
      let cleanText = text.replace(/[\s\u00A0]+$/, '');
      
      // Ensure there is a colon if the text doesn't already have one
      if (!cleanText.includes(':') && label !== 'CMND/CCCD') {
        cleanText += ':';
      }
      
      // Append the value with a leading space
      return tStart + cleanText + ' ' + value + tEnd;
    }
  );
}

/**
 * For Section C: dots in same <w:t> with label + unit.
 * e.g. "Chiều cao: ..................cm"
 */
function fillDotsInSameRun(xml, label, value) {
  if (!value) return xml;
  const escaped = escapeRegExp(label);
  return xml.replace(
    new RegExp('(<w:t[^>]*>)(' + escaped + '\\s*)[\\s\u00A0…\\.]{2,}([^<]*)(</w:t>)', 'g'),
    (m, tStart, labelPart, trailing, tEnd) => {
      const unit = trailing.trim();
      const sep = unit ? ' ' : '';
      return tStart + labelPart + ' ' + value + sep + unit + tEnd;
    }
  );
}



function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
}

// ============================
// STATUS MANAGEMENT
// ============================
function setStatus(type, message) {
  const bar = document.getElementById('statusBar');
  const text = document.getElementById('statusText');
  bar.className = 'status-bar ' + type;
  text.textContent = message;
}
