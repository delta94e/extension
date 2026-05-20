const fs = require('fs');
const JSZip = require('jszip');

async function test() {
  const data = fs.readFileSync('/Users/truongnguyen/extension/cccd-extension/template.docx');
  const zip = await JSZip.loadAsync(data);
  let xml = await zip.file('word/document.xml').async('string');

  function fillDotsInParagraph(xml, keyword, value) {
    if (!value) return xml;
    let startSearch = 0;
    while (true) {
      const kwIdx = xml.indexOf(keyword, startSearch);
      if (kwIdx === -1) break;
      startSearch = kwIdx + keyword.length;

      const pStart = xml.lastIndexOf('<w:p ', kwIdx);
      const pEnd = xml.indexOf('</w:p>', kwIdx);
      if (pStart === -1 || pEnd === -1) continue;

      const before = xml.substring(0, pStart);
      let para = xml.substring(pStart, pEnd + 6);
      const after = xml.substring(pEnd + 6);

      if (para.indexOf('…') === -1 && para.indexOf('..') === -1) continue;

      let step1Applied = false;
      para = para.replace(
        /(<w:t[^>]*>)([^<]*[\s…\.]{3,})(<\/w:t>)/g,
        (match, tStart, content, tEnd) => {
          if (content.indexOf('…') === -1 && content.indexOf('..') === -1) return match;
          if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(content)) return match;
          step1Applied = true;
          const cleaned = content.replace(/[\s…\.]{3,}/g, ' ' + value + ' ');
          return tStart + cleaned.trim() + tEnd;
        }
      );

      let firstDot = true;
      para = para.replace(
        /<w:t[^>]*>([\s\u00A0…\.]{3,})<\/w:t>/g,
        (match) => {
          if (!step1Applied && firstDot) {
            firstDot = false;
            return '<w:t xml:space="preserve"> ' + value + '</w:t>';
          }
          return '<w:t></w:t>';
        }
      );

      xml = before + para + after;
      break;
    }
    return xml;
  }
  
  xml = fillDotsInParagraph(xml, 'Dân tộc', 'Kinh');
  
  const dIdx = xml.indexOf('Dân tộc');
  console.log("Dân tộc text context:", xml.substring(dIdx, dIdx + 150).replace(/<[^>]+>/g, ''));
  
  const gIdx = xml.indexOf('Giới tính');
  console.log("Giới tính context:", xml.substring(gIdx, gIdx + 100).replace(/<[^>]+>/g, ''));
}
test();
