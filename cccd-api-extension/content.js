// Content script for CCCD Extractor (API Interception Version)

let latestPatientData = {};

// 1. Tiêm mã Đánh chặn (Inject Script) vào trang web chính
function injectScript(file_path, node) {
    const th = document.getElementsByTagName(node)[0];
    const s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file_path);
    th.appendChild(s);
}
injectScript(chrome.runtime.getURL('inject.js'), 'body');

// 2. Lắng nghe dữ liệu tuồn ra từ Inject Script
window.addEventListener('message', function(event) {
    // Chỉ nhận message từ chính cửa sổ này
    if (event.source !== window) return;

    if (event.data.type && (event.data.type === 'API_INTERCEPT')) {
        try {
            const rawData = JSON.parse(event.data.data);
            console.log("🔥 Lấy được JSON gốc từ API:", event.data.url, rawData);
            
            // Ép phẳng JSON (nếu có Object lồng nhau)
            const flatData = flattenObject(rawData);
            
            // Cập nhật dữ liệu mới nhất
            latestPatientData = mapJsonToStandardFormat(flatData);
        } catch (e) {
            // Không phải JSON hợp lệ
        }
    }
});

// 3. Phản hồi yêu cầu Trích xuất từ Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    // Nếu chưa bắt được dữ liệu nào
    if (Object.keys(latestPatientData).length === 0) {
        sendResponse({ error: "Chưa bắt được dữ liệu JSON từ máy chủ. Vui lòng F5 (tải lại trang bệnh nhân) để tiện ích lấy dữ liệu gốc!" });
    } else {
        sendResponse({ result: latestPatientData });
    }
  }
  return true;
});

// ====== CÁC HÀM XỬ LÝ JSON ======

function flattenObject(ob) {
    var toReturn = {};
    for (var i in ob) {
        if (!ob.hasOwnProperty(i)) continue;
        if ((typeof ob[i]) == 'object' && ob[i] !== null) {
            if (Array.isArray(ob[i])) {
                // Lấy phần tử đầu tiên nếu là mảng
                if(ob[i].length > 0 && typeof ob[i][0] === 'object') {
                    var flatObject = flattenObject(ob[i][0]);
                    for (var x in flatObject) {
                        if (!flatObject.hasOwnProperty(x)) continue;
                        toReturn[i + '.' + x] = flatObject[x];
                    }
                }
            } else {
                var flatObject = flattenObject(ob[i]);
                for (var x in flatObject) {
                    if (!flatObject.hasOwnProperty(x)) continue;
                    toReturn[i + '.' + x] = flatObject[x];
                }
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}

function findValueByKeys(flatObj, keys) {
    for (const key of keys) {
        // Tìm khoá có chứa từ khóa (không phân biệt hoa thường)
        const matchedKey = Object.keys(flatObj).find(k => k.toLowerCase().includes(key.toLowerCase()));
        if (matchedKey && flatObj[matchedKey]) {
            return flatObj[matchedKey].toString().trim();
        }
    }
    return '';
}

function mapJsonToStandardFormat(flatData) {
    const data = {};

    // Map các trường dữ liệu theo danh sách từ khoá dự đoán
    data.tenDayDu = findValueByKeys(flatData, ['tenDayDu', 'hoTen', 'patientName', 'tenBenhNhan']);
    
    // Xử lý Giới tính (có thể trả về 1/0, M/F hoặc Nam/Nữ)
    let gt = findValueByKeys(flatData, ['gioiTinh', 'gender', 'sex']);
    if (gt == '1' || gt.toLowerCase() == 'm' || gt.toLowerCase() == 'nam') data.gioiTinh = 'Nam';
    else if (gt == '2' || gt == '0' || gt.toLowerCase() == 'f' || gt.toLowerCase() == 'nữ') data.gioiTinh = 'Nữ';
    else data.gioiTinh = gt;

    data.ngaySinh = findValueByKeys(flatData, ['ngaySinh', 'dob', 'dateOfBirth']);
    data.namSinh = findValueByKeys(flatData, ['namSinh', 'birthYear']);
    if (!data.ngaySinh && data.namSinh) data.ngaySinh = data.namSinh;

    data.dienThoaiDiDong = findValueByKeys(flatData, ['dienThoai', 'phone', 'mobile']);
    data.cmnd = findValueByKeys(flatData, ['cmnd', 'cccd', 'idCard']);
    data.danToc = findValueByKeys(flatData, ['danToc', 'ethnic']);
    data.quocTich = findValueByKeys(flatData, ['quocTich', 'nationality']);
    
    data.soNha = findValueByKeys(flatData, ['soNha', 'diaChi', 'address']);
    data.xaPhuong = findValueByKeys(flatData, ['xaPhuong', 'ward']);
    data.tinhTP = findValueByKeys(flatData, ['tinh', 'thanhPho', 'city', 'province']);

    data.soThe = findValueByKeys(flatData, ['soThe', 'bhyt', 'insurance']);
    data.ngheNghiep = findValueByKeys(flatData, ['ngheNghiep', 'job', 'occupation']);

    data.tenNguoiThan = findValueByKeys(flatData, ['nguoiThan', 'nguoiLienHe', 'contactName']);
    data.dienThoaiNguoiThan = findValueByKeys(flatData, ['dtNguoiThan', 'contactPhone']);

    // Chỉ số sinh tồn
    data.mach = findValueByKeys(flatData, ['mach', 'pulse']);
    data.nhietDo = findValueByKeys(flatData, ['nhietDo', 'temperature']);
    data.nhipTho = findValueByKeys(flatData, ['nhipTho']);
    data.canNang = findValueByKeys(flatData, ['canNang', 'weight']);
    data.chieuCao = findValueByKeys(flatData, ['chieuCao', 'height']);
    
    return data;
}
