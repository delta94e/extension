const DEFAULT_MAPPING = {
  hoten: ['họ và tên', 'họ tên', 'tên đầy đủ', 'full name', 'tên bệnh nhân', 'tên', 'tendaydu', 'hoten'],
  dienthoai: ['sđt', 'điện thoại', 'đtdđ', 'số đt', 'phone', 'số điện thoại', 'dienthoai'],
  cmnd: ['cmnd', 'cccd', 'chứng minh nhân dân', 'căn cước công dân', 'số định danh', 'số cccd', 'căn cước', 'hộ chiếu'],
  gioitinh: ['giới tính', 'gender', 'phái', 'gioitinh'],
  ngaysinh: ['ngày sinh', 'sinh ngày', 'dob', 'date of birth', 'ngaysinh'],
  namsinh: ['năm sinh', 'namsinh'],
  diachi: ['địa chỉ', 'nơi ở', 'thường trú', 'chỗ ở', 'address', 'diachi'],
  sonha: ['số nhà', 'đường phố', 'thôn xóm', 'đường', 'sonha'],
  xaphuong: ['xã', 'phường', 'xã/phường', 'phường/xã', 'xaphuong'],
  quanhuyen: ['quận', 'huyện', 'quận/huyện', 'huyện/quận', 'quanhuyen'],
  tinhtp: ['tỉnh', 'thành phố', 'tỉnh/tp', 'tp', 'tinhtp'],
  dantoc: ['dân tộc', 'dantoc'],
  quoctich: ['quốc tịch', 'quoctich'],
  nghenghiep: ['nghề nghiệp', 'công việc', 'nghenghiep'],
  sothe: ['số thẻ', 'bhyt', 'thẻ bhyt', 'sothe']
};

let extractedData = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSettings();
  
  document.getElementById('btnExtract').addEventListener('click', handleExtract);
  document.getElementById('btnExport').addEventListener('click', handleExport);
});

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active to current
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

function initSettings() {
  const formContainer = document.getElementById('mappingForm');
  
  chrome.storage.local.get(['customMapping'], (result) => {
    const mapping = result.customMapping || DEFAULT_MAPPING;
    renderMappingForm(mapping, formContainer);
  });

  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    try {
      const inputs = document.querySelectorAll('.mapping-input');
      const newMapping = {};
      inputs.forEach(input => {
        const key = input.dataset.key;
        const keywords = input.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        newMapping[key] = keywords;
      });
      
      chrome.storage.local.set({ customMapping: newMapping }, () => {
        setStatus('success', 'Đã lưu cấu hình từ khoá!');
      });
    } catch (e) {
      setStatus('error', 'Lỗi lưu trữ: ' + e.message);
    }
  });

  document.getElementById('btnResetSettings').addEventListener('click', () => {
    renderMappingForm(DEFAULT_MAPPING, formContainer);
    chrome.storage.local.remove('customMapping', () => {
      setStatus('success', 'Đã reset về mặc định!');
    });
  });
}

function renderMappingForm(mapping, container) {
  container.innerHTML = '';
  for (const [key, keywords] of Object.entries(mapping)) {
    const row = document.createElement('div');
    row.className = 'mapping-row';
    
    const label = document.createElement('label');
    label.className = 'mapping-label';
    label.textContent = `Trường: ${key}`;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'mapping-input';
    input.dataset.key = key;
    input.value = keywords.join(', ');
    input.placeholder = 'Ví dụ: họ tên, tên đầy đủ';
    
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  }
}

async function handleExtract() {
  setStatus('loading', 'Đang trích xuất...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('Không tìm thấy tab active');

    chrome.tabs.sendMessage(tab.id, { action: 'extract' }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('error', 'Lỗi kết nối. Vui lòng reload trang web và thử lại.');
        return;
      }
      
      if (response && response.result) {
        extractedData = response.result;
        displayData(extractedData);
        setStatus('success', `Đã trích xuất ${Object.keys(extractedData).length} trường.`);
        document.getElementById('btnExport').disabled = false;
      } else if (response && response.error) {
        setStatus('error', response.error);
      } else {
        setStatus('error', 'Không nhận được dữ liệu.');
      }
    });
  } catch (err) {
    setStatus('error', err.message);
  }
}

function displayData(data) {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  
  const keys = Object.keys(data);
  if (keys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Không tìm thấy dữ liệu khớp</td></tr>';
    return;
  }

  for (const [k, v] of Object.entries(data)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${k}</strong></td><td>${v}</td>`;
    tbody.appendChild(tr);
  }
}

async function handleExport() {
  if (!extractedData) return;
  
  setStatus('loading', 'Đang xử lý template...');
  const fileInput = document.getElementById('templateUpload');
  
  try {
    let arrayBuffer;
    
    if (fileInput.files.length > 0) {
      // Use uploaded file
      arrayBuffer = await fileInput.files[0].arrayBuffer();
    } else {
      // Use default template
      const url = chrome.runtime.getURL('default_template.docx');
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không tìm thấy default_template.docx');
      arrayBuffer = await res.arrayBuffer();
    }

    const zip = await JSZip.loadAsync(arrayBuffer);
    let docXml = await zip.file('word/document.xml').async('string');
    
    // Replace logic: We support '{key}' syntax first
    for (const [key, value] of Object.entries(extractedData)) {
       // Replace {key} using regex
       const regex = new RegExp(`\\{${key}\\}`, 'g');
       docXml = docXml.replace(regex, value);
    }
    
    // Fallback: old label appending logic for default template
    if (fileInput.files.length === 0) {
       docXml = applyOldTemplateLogic(docXml, extractedData);
    }

    zip.file('word/document.xml', docXml);
    const modifiedBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    const blob = new Blob([modifiedBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    const blobUrl = URL.createObjectURL(blob);
    
    const patientName = extractedData.hoten || extractedData.tendaydu || 'Export';
    const safeName = patientName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Extracted_${safeName}.docx`;

    chrome.runtime.sendMessage({
      action: 'downloadDocx',
      blobUrl: blobUrl,
      fileName: fileName
    }, (response) => {
      if (response && response.success) {
        setStatus('success', 'Đã tải xuống file Word!');
      } else {
        setStatus('error', 'Lỗi tải xuống: ' + (response?.error || 'Unknown'));
      }
    });

  } catch (err) {
    console.error(err);
    setStatus('error', 'Lỗi xuất file: ' + err.message);
  }
}

function setStatus(type, msg) {
  const box = document.getElementById('statusBox');
  box.className = `status-box ${type}`;
  box.textContent = msg;
}

// Fallback logic to support the provided `default_template.docx` which doesn't have `{key}` tags
function applyOldTemplateLogic(xml, data) {
  if (data.hoten) xml = appendValueToLabel(xml, 'Họ và tên', data.hoten);
  if (data.cmnd) xml = appendValueToLabel(xml, 'CMND/CCCD', data.cmnd);
  if (data.dienthoai) xml = appendValueToLabel(xml, 'Điện thoại di động', data.dienthoai);
  if (data.sothe) xml = appendValueToLabel(xml, 'thẻ BHYT', data.sothe.replace(/\|/g, ''));
  if (data.dantoc) xml = appendValueToLabel(xml, 'Dân tộc', data.dantoc);
  
  if (data.ngaysinh) xml = appendValueToLabel(xml, 'Ngày sinh', data.ngaysinh);
  else if (data.namsinh) xml = appendValueToLabel(xml, 'Ngày sinh', '..../..../' + data.namsinh);

  let address = [data.sonha, data.xaphuong, data.tinhtp].filter(Boolean).join(', ');
  if (address) xml = appendValueToLabel(xml, 'đường phố', address);
  
  return xml;
}

function appendValueToLabel(xml, label, value) {
  if (!value) return xml;
  let escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return xml.replace(
    new RegExp('(<w:t[^>]*>)([^<]*?' + escaped + '[^<]*)(<\\/w:t>)', 'g'),
    (match, tStart, text, tEnd) => {
      let cleanText = text.replace(/[\s\u00A0]+$/, '');
      if (!cleanText.includes(':') && label !== 'CMND/CCCD') cleanText += ':';
      return tStart + cleanText + ' ' + value + tEnd;
    }
  );
}
