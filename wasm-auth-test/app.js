// Nhập hàm authenticate từ file release.js (file wrapper do AssemblyScript tự sinh ra)
// File này sẽ lo việc load `release.wasm` và quản lý bộ nhớ để truyền chuỗi (string) qua lại giữa JS và Wasm.
import { authenticate } from "./build/release.js";

document.getElementById('btn').addEventListener('click', () => {
  const pwd = document.getElementById('pwd').value;
  const resultDiv = document.getElementById('result');
  
  // Gọi hàm chạy sâu bên trong lõi mã máy Wasm
  const secretKey = authenticate(pwd);

  resultDiv.style.display = 'block';
  
  if (secretKey) {
    resultDiv.className = 'success';
    resultDiv.innerHTML = `Thành công!<br>Mã bí mật từ Wasm:<br><strong>${secretKey}</strong>`;
  } else {
    resultDiv.className = 'error';
    resultDiv.innerHTML = `Sai mật khẩu! Hacker không thể xem được mã bí mật.`;
  }
});
