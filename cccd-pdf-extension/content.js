// Content script for CCCD Extractor
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

  // ====== HELPER FUNCTIONS ======
  function getInput(name) {
    const el = document.querySelector(`input[name="${name}"]`);
    return el ? el.value || '' : '';
  }

  function getSelect(fieldName) {
    const container = document.querySelector(`.nz-col-${fieldName}`);
    if (container) {
      const item = container.querySelector('nz-select-item');
      if (item) return item.getAttribute('title') || item.textContent?.trim() || '';
      
      // Fallback: check for radio buttons (important for Giới tính)
      const checkedRadio = container.querySelector('input[type="radio"]:checked');
      if (checkedRadio) {
        const label = checkedRadio.closest('label');
        return label ? label.textContent?.trim() : checkedRadio.value;
      }
      
      const selectedSpan = container.querySelector('.ant-select-selection-item');
      if (selectedSpan) return selectedSpan.getAttribute('title') || selectedSpan.textContent?.trim() || '';
    }
    return '';
  }

  function getDate(fieldName) {
    const container = document.querySelector(`.nz-col-${fieldName}`);
    if (container) {
      const oraInput = container.querySelector('input.ora-input-date');
      if (oraInput && oraInput.value) return oraInput.value;
      const dateInput = container.querySelector('.ant-picker-input input');
      if (dateInput && dateInput.value) return dateInput.value;
      const inputs = container.querySelectorAll('input');
      for (const input of inputs) {
        if (input.value && /\d{2}\/\d{2}\/\d{4}/.test(input.value)) return input.value;
      }
    }
    return '';
  }

  function getFromContainer(fieldName) {
    const container = document.querySelector(`.nz-col-${fieldName}`);
    if (container) {
      // Try regular text input
      const input = container.querySelector('input.ant-input:not(.ant-select-selection-search-input)');
      if (input) return input.value || '';
      // Try nz-input-number
      const numInput = container.querySelector('input.ant-input-number-input');
      if (numInput) return numInput.value || '';
      // Try nz-select-item
      const item = container.querySelector('nz-select-item');
      if (item) return item.getAttribute('title') || item.textContent?.trim() || '';
    }
    return '';
  }

  function getNumberFromContainer(fieldName) {
    const container = document.querySelector(`.nz-col-${fieldName}`);
    if (container) {
      const numInput = container.querySelector('input.ant-input-number-input');
      if (numInput) return numInput.value || '';
      const input = container.querySelector('input.ant-input:not(.ant-select-selection-search-input)');
      if (input) return input.value || '';
    }
    return '';
  }

  // ====== SECTION A: THÔNG TIN HÀNH CHÍNH ======
  // Text inputs
  data.tenDayDu = getInput('tenDayDu');
  data.soNha = getInput('soNha');
  data.dienThoaiDiDong = getInput('dienThoaiDiDong');
  data.cmnd = getInput('cmnd');
  data.maBenhNhan = getInput('maBenhNhan');
  data.tenNguoiThan = getInput('tenNguoiThan');
  data.cmndNguoiThan = getInput('cmndNguoiThan');
  data.dienThoaiNguoiThan = getInput('dienThoaiNguoiThan');

  // Select dropdowns
  data.gioiTinh = getSelect('gioiTinh');
  data.tinhTP = getSelect('tinhId725');
  data.xaPhuong = getSelect('xaId725');
  data.thonXom = getSelect('thonXomId');
  data.danToc = getSelect('danTocId');
  data.quocTich = getSelect('quocTichId');
  data.noiCapCmnd = getSelect('noiCapCmnd');
  data.ngheNghiep = getSelect('ngheNghiepId');
  data.quanHe = getSelect('quanHeId');
  data.nhomDoiTuong = getSelect('nhomDoiTuongId');

  // Date fields
  data.ngaySinh = getDate('ngaySinh');
  data.namSinh = getFromContainer('namSinh');
  data.thangSinh = getFromContainer('thangSinh');
  data.tuoi = getFromContainer('tuoi');
  data.ngayCapCmnd = getDate('ngayCapCmnd');

  // Other
  data.soThe = getFromContainer('soThe');
  data.diaChiLamViec = getInput('diaChiLamViec') || getFromContainer('diaChiLamViec');

  // ====== SECTION C: CHỈ SỐ SINH TỒN (KHÁM THỰC THỂ) ======
  data.mach = getNumberFromContainer('mach');
  data.nhietDo = getNumberFromContainer('nhietDo');
  data.nhipTho = getNumberFromContainer('nhipTho');
  data.canNang = getNumberFromContainer('canNang');
  data.chieuCao = getNumberFromContainer('chieuCao');
  data.vongEo = getNumberFromContainer('vongEo');
  data.duongMau = getNumberFromContainer('duongMau');
  data.bmi = getNumberFromContainer('bmi');

  // Huyết áp - special: 2 inputs in one container (TT/TTr)
  const huyetApContainer = document.querySelector('.nz-col-mach');
  if (huyetApContainer) {
    // There are two nz-col-mach containers; the second one is blood pressure
    const allMach = document.querySelectorAll('.nz-col-mach');
    if (allMach.length >= 2) {
      const bpContainer = allMach[1]; // Second one is Huyết áp
      const bpInputs = bpContainer.querySelectorAll('input.ant-input');
      if (bpInputs.length >= 2) {
        data.huyetApTT = bpInputs[0].value || '';
        data.huyetApTTr = bpInputs[1].value || '';
      } else if (bpInputs.length === 1) {
        data.huyetApTT = bpInputs[0].value || '';
        data.huyetApTTr = '';
      }
    }
  }

  // ====== SECTION D-G: KHÁM LÂM SÀNG & KẾT QUẢ ======
  // Lý do vào viện / Triệu chứng
  data.lyDoVaoVien = getFromContainer('lyDoVaoVien');
  data.trieuChungLamSang = getFromContainer('trieuChungLamSang');
  data.dienBienDieuTri = getFromContainer('dienBienDieuTri');
  data.phuongPhapKhamBenh = getFromContainer('phuongPhapKhamBenh');
  data.ketQuaKham = getFromContainer('ketQuaKham');
  data.tuVanDieuTri = getFromContainer('tuVanDieuTri');
  data.ghiChu = getFromContainer('ghiChu');

  // Bệnh chính & bệnh kèm theo
  data.benhChinh = getSelect('benhChinhId');
  data.dienGiaiBenhChinh = getFromContainer('dienGiaiBenhChinh');
  data.benhKemTheo = getSelect('benhKemTheoId');
  data.dienGiaiBenhKemTheo = getFromContainer('dienGiaiBenhKemTheo');

  // Bác sĩ khám
  data.bacSiKham = getSelect('bacSiKhamId');

  return data;
}
