import fs from 'fs';
import { instantiate } from "@assemblyscript/loader";

async function run() {
  const wasmFile = fs.readFileSync('/Users/truongnguyen/extension/wasm-auth-test/build/release.wasm');
  const { exports } = await instantiate(wasmFile, { env: { abort: () => {} } });
  
  // Wasm exported function: authenticate
  // Need to use the memory lifting logic from release.js to call it from raw JS.
  // Actually, I can just use release.js!
}
