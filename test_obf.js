const JavaScriptObfuscator = require('javascript-obfuscator');
const code = `
function extractDataFromPage() {
  const data = {};
  data.hello = "world";
  return data;
}
console.log(extractDataFromPage.toString());
`;
const obfuscated = JavaScriptObfuscator.obfuscate(code, { stringArray: true }).getObfuscatedCode();
console.log(obfuscated);
