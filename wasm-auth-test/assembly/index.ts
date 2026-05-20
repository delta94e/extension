// The entry file of your WebAssembly module.

export function authenticate(password: string): string {
  // Kiểm tra độ dài mật khẩu "1905@DEV"
  if (password.length != 8) return "";
  
  // Kiểm tra từng ký tự thay vì lưu chuỗi "1905@DEV" trong Wasm.
  // Điều này giúp hacker không thể dùng lệnh `strings` để moi được mật khẩu.
  if (password.charCodeAt(0) != 49) return ""; // '1'
  if (password.charCodeAt(1) != 57) return ""; // '9'
  if (password.charCodeAt(2) != 48) return ""; // '0'
  if (password.charCodeAt(3) != 53) return ""; // '5'
  if (password.charCodeAt(4) != 64) return ""; // '@'
  if (password.charCodeAt(5) != 68) return ""; // 'D'
  if (password.charCodeAt(6) != 69) return ""; // 'E'
  if (password.charCodeAt(7) != 86) return ""; // 'V'

  // Mật khẩu đúng! Giải mã Secret Key.
  // Chìa khóa "DOCX_KEY_1905" được mã hoá bằng phép XOR với 0x42
  let result = "";
  let xor_key: u16 = 0x42;
  // Các byte của "DOCX_KEY_1905" sau khi XOR:
  let bytes: u16[] = [0x06, 0x0d, 0x01, 0x1a, 0x1d, 0x09, 0x07, 0x1b, 0x1d, 0x73, 0x7b, 0x72, 0x77];
  
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i] ^ xor_key);
  }
  
  return result;
}
