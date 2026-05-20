// Content script for CCCD Extractor (Smart Label Version)
// Listens for messages from popup to extract data from the web form

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    try {
      const data = extractDataFromPage();
      sendResponse({ result: data });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  }
  return true;
});

function extractDataFromPage() {
  const data = {};

  // ====== SMART LABEL SCRAPING ALGORITHM ======
  // Thuật toán này bám theo chữ hiển thị trên màn hình (Label) thay vì class name của lập trình viên
  function findValueByLabel(labelText, isPrefix = false) {
    // 1. Tìm tất cả thẻ <label> hoặc các thẻ div chứa text
    // Trong Ant Design, nhãn thường nằm trong thẻ <label>
    const labels = Array.from(document.querySelectorAll('label, .ant-form-item-label div'));
    
    const targetLabel = labels.find(l => {
      const text = l.textContent.replace(/[:*\s]+/g, ' ').trim().toLowerCase();
      const target = labelText.toLowerCase();
      return isPrefix ? text.startsWith(target) : text === target;
    });

    if (targetLabel) {
      // 2. Đi ngược lên DOM tree để tìm thẻ bọc ngoài cùng của nhóm trường này (ant-form-item)
      let wrapper = targetLabel.closest('.ant-form-item');
      
      // Nếu không dùng form chuẩn Ant Design, ta lùi lên 2 cấp HTML làm dự phòng
      if (!wrapper) {
        wrapper = targetLabel.parentElement?.parentElement;
      }

      if (wrapper) {
        // 3. Quét các thẻ input/select/radio nằm trong phạm vi wrapper này
        
        // Ưu tiên 1: Dropdown Select
        const selectItem = wrapper.querySelector('nz-select-item, .ant-select-selection-item');
        if (selectItem) return selectItem.getAttribute('title') || selectItem.textContent?.trim() || '';

        // Ưu tiên 2: Radio Button (Ví dụ: Giới tính)
        const checkedRadio = wrapper.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
          const radioLabel = checkedRadio.closest('label');
          return radioLabel ? radioLabel.textContent?.trim() : checkedRadio.value;
        }

        // Ưu tiên 3: Text Input / Date Input / Number Input
        // Bỏ qua thẻ search ẩn của thư viện Select
        const input = wrapper.querySelector('input:not([type="hidden"]):not(.ant-select-selection-search-input)');
        if (input) return input.value || '';

        // Ưu tiên 4: Textarea (Khung nhập văn bản lớn)
        const textarea = wrapper.querySelector('textarea');
        if (textarea) return textarea.value || '';
      }
    }
    
    return '';
  }

  // ====== SECTION A: THÔNG TIN HÀNH CHÍNH ======
  // Các nhãn này dựa theo chữ tiếng Việt thực tế hiển thị trên form Bệnh viện
  data.tenDayDu = findValueByLabel('họ và tên');
  data.gioiTinh = findValueByLabel('giới tính');
  
  // Ngày sinh có thể nằm ở label riêng hoặc gom chung
  data.ngaySinh = findValueByLabel('ngày sinh', true); 
  data.namSinh = findValueByLabel('năm sinh');
  if (!data.ngaySinh && data.namSinh) {
    // Nếu chỉ có năm sinh
    data.ngaySinh = data.namSinh;
  }

  data.dienThoaiDiDong = findValueByLabel('điện thoại');
  data.cmnd = findValueByLabel('cmnd/cccd', true) || findValueByLabel('số cccd', true) || findValueByLabel('cmnd', true);
  data.danToc = findValueByLabel('dân tộc');
  data.quocTich = findValueByLabel('quốc tịch');
  
  // Địa chỉ
  data.soNha = findValueByLabel('số nhà', true) || findValueByLabel('địa chỉ', true);
  data.xaPhuong = findValueByLabel('xã/phường', true);
  data.tinhTP = findValueByLabel('tỉnh/tp', true) || findValueByLabel('tỉnh/thành phố', true);

  // BHYT / Thẻ
  data.soThe = findValueByLabel('số the bhyt', true) || findValueByLabel('thẻ bhyt', true);
  data.ngheNghiep = findValueByLabel('nghề nghiệp');

  // Người thân
  data.tenNguoiThan = findValueByLabel('người liên hệ', true) || findValueByLabel('người nhà', true);
  data.dienThoaiNguoiThan = findValueByLabel('đt người liên hệ', true) || findValueByLabel('đt người nhà', true);

  // ====== SECTION C: CHỈ SỐ SINH TỒN (NẾU CÓ) ======
  data.mach = findValueByLabel('mạch');
  data.nhietDo = findValueByLabel('nhiệt độ');
  data.nhipTho = findValueByLabel('nhịp thở');
  data.canNang = findValueByLabel('cân nặng');
  data.chieuCao = findValueByLabel('chiều cao');
  
  // Huyết áp thường có 2 ô trong 1 label
  const haLabel = Array.from(document.querySelectorAll('label')).find(l => l.textContent.toLowerCase().includes('huyết áp'));
  if (haLabel) {
    const haWrapper = haLabel.closest('.ant-form-item') || haLabel.parentElement?.parentElement;
    if (haWrapper) {
      const inputs = haWrapper.querySelectorAll('input.ant-input');
      if (inputs.length >= 2) {
        data.huyetApTT = inputs[0].value || '';
        data.huyetApTTr = inputs[1].value || '';
      }
    }
  }

  return data;
}
