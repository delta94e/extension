chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    chrome.storage.local.get(['customMapping'], (result) => {
      const mapping = result.customMapping || DEFAULT_MAPPING;
      try {
        const data = extractSmartData(mapping);
        sendResponse({ result: data });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    });
    return true; 
  }
});

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/[:*]/g, '');
}

function findAllTextNodes(root, nodesArray = []) {
  if (!root) return nodesArray;
  
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue.trim();
      if (text) {
        nodesArray.push({ node, text: normalizeText(text) });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) {
      findAllTextNodes(node.shadowRoot, nodesArray);
    }
  }
  return nodesArray;
}

function findAllInputs(root, inputsArray = []) {
  if (!root) return inputsArray;
  
  const els = root.querySelectorAll('*');
  for (const el of els) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      inputsArray.push(el);
    } else if (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'textbox' || el.isContentEditable) {
      inputsArray.push(el);
    }
    if (el.shadowRoot) {
      findAllInputs(el.shadowRoot, inputsArray);
    }
  }
  return inputsArray;
}

function getElementValue(el) {
  if (el.tagName === 'INPUT') {
    if (el.type === 'radio' || el.type === 'checkbox') {
      return el.checked ? (el.value || 'true') : null;
    }
    if (el.type === 'hidden') {
      // Hidden inputs are often used to store values for custom UI components.
      // The visual text is usually somewhere in the parent hierarchy.
      let current = el.parentElement;
      for (let i = 0; i < 3 && current; i++) {
        const text = current.innerText ? current.innerText.trim() : '';
        if (text && text.length > 0 && text.length < 100) {
          return text.split('\n')[0].trim();
        }
        current = current.parentElement;
      }
      return el.value;
    }
    return el.value;
  }
  if (el.tagName === 'SELECT') {
    return el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '';
  }
  if (el.tagName === 'TEXTAREA') return el.value;
  
  // Generic custom components (e.g. role="combobox", contenteditable)
  const text = el.innerText || el.textContent || '';
  return text.trim().split('\n')[0].trim();
}

function findValueFromContainer(container) {
  // 1. Look for visible inputs first
  const input = container.querySelector('input:not([type="hidden"]), select, textarea, [role="combobox"]');
  if (input) return getElementValue(input);
  
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(container.tagName) || container.getAttribute('role') === 'combobox') {
    if (container.type !== 'hidden') return getElementValue(container);
  }

  // 2. Hidden inputs (custom framework dropdowns)
  const hiddenInput = container.querySelector('input[type="hidden"]');
  if (hiddenInput) return getElementValue(hiddenInput);

  // 3. Fallback: Get visible text of the container if it's small enough
  const text = container.innerText ? container.innerText.trim() : container.textContent.trim();
  if (text && text.length < 100) {
    return text.split('\n')[0].trim();
  }
  return null;
}

function extractSmartData(mapping) {
  const extractedData = {};
  
  // 1. Find all text nodes (INCLUDING Shadow DOM)
  const textNodes = findAllTextNodes(document.body);

  // 2. Process each field mapping
  for (const [key, keywords] of Object.entries(mapping)) {
    let foundValue = null;
    
    // Sort keywords by length descending to match longer specific phrases first
    const sortedKws = [...keywords].sort((a, b) => b.length - a.length);

    // Strategy A: Visual search by Label Text
    for (const kw of sortedKws) {
      // Find a text node that matches exactly or contains the keyword (but not too long to avoid menu items)
      const matchNode = textNodes.find(n => n.text === kw || n.text === kw + ':' || n.text === kw + '*' || (n.text.includes(kw) && n.text.length <= kw.length + 15));
      if (matchNode) {
        const labelEl = matchNode.node.parentElement;
        
        // 1. Check inside the label element itself
        let input = labelEl.querySelector('input:not([type="hidden"]), select, textarea, [role="combobox"]');
        if (input) {
          foundValue = getElementValue(input);
          if (foundValue) break;
        }

        // 2. Check next siblings of the label element
        let sibling = labelEl.nextElementSibling;
        while (sibling) {
          if (sibling.tagName === 'LABEL') {
            sibling = sibling.nextElementSibling;
            continue;
          }
          foundValue = findValueFromContainer(sibling);
          break; 
        }
        if (foundValue !== null && foundValue !== undefined && foundValue !== '') break;

        // 3. Check parent's next siblings
        if (labelEl.parentElement) {
          let parentSibling = labelEl.parentElement.nextElementSibling;
          while (parentSibling) {
             if (parentSibling.tagName === 'LABEL') {
               parentSibling = parentSibling.nextElementSibling;
               continue;
             }
             foundValue = findValueFromContainer(parentSibling);
             break;
          }
        }
        if (foundValue !== null && foundValue !== undefined && foundValue !== '') break;
      }
    }

    // Strategy B: Fallback to searching all inputs and components
    if (!foundValue) {
      const allInputs = findAllInputs(document.body);
      for (const input of allInputs) {
        let classNames = input.className || '';
        // Add class names of up to 3 parent elements to catch generic wrappers
        let current = input.parentElement;
        for (let i = 0; i < 3 && current; i++) {
          classNames += ' ' + (current.className || '');
          current = current.parentElement;
        }
        
        const combined = [
          input.name, 
          input.id, 
          input.getAttribute('placeholder'), 
          input.getAttribute('title'),
          classNames
        ].map(s => normalizeText(s || '')).join(' ');

        if (sortedKws.some(kw => {
          if (kw.length <= 3) {
            // Require word boundary for short keywords like 'tp', 'xã'
            const regex = new RegExp(`(^|[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])` + kw + `([^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|$)`, 'i');
            return regex.test(combined);
          }
          return combined.includes(kw);
        })) {
          foundValue = getElementValue(input);
          if (foundValue) break;
        }
      }
    }
    
    // Save valid value
    if (foundValue && foundValue !== 'on' && foundValue !== 'true') {
      extractedData[key] = foundValue;
    }
  }

  // Fallback for Gender Radios if missed (INCLUDING Shadow DOM)
  if (!extractedData.gioitinh || extractedData.gioitinh === 'on' || extractedData.gioitinh === 'true') {
    const allInputs = findAllInputs(document.body);
    const radios = allInputs.filter(el => el.type === 'radio' && el.checked);
    radios.forEach(r => {
      let label = r.value;
      if (r.parentElement) label += ' ' + r.parentElement.textContent;
      label = normalizeText(label);
      if (label.includes('nam') || label.includes('nữ') || label.includes('male') || label.includes('female')) {
        extractedData.gioitinh = label.includes('nam') ? 'nam' : (label.includes('nữ') ? 'nữ' : label);
      }
    });
  }

  return extractedData;
}
