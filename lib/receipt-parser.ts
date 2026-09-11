export interface ScannedReceiptResult {
  date?: string; // YYYY-MM-DDThh:mm format for datetime-local
  location?: string;
  totalAmount?: number;
  details?: string;
  incomplete: boolean;
  errors?: string[];
  rawText?: string;
}

export function parseMOFReceipt(ocrText: string): ScannedReceiptResult {
  // Normalize some common OCR spaces and characters before splitting
  const normalizedText = ocrText
    .replace(/O/g, '0') // sometimes zeros are read as O
    .replace(/／/g, '/');
    
  const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let date: string | undefined;
  let location: string | undefined;
  let totalAmount: number | undefined;
  let details: string | undefined;

  // 1. Date: Looks for YYYY/MM/DD HH:mm:ss
  // Example: 2026/8/28 19:34:21
  const dateRegex = /(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2})/;
  let dateLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(dateRegex);
    if (match) {
      dateLineIdx = i;
      const parts = match[1].split(/\s+/);
      const dateParts = parts[0].split('/');
      const Y = dateParts[0];
      const M = dateParts[1].padStart(2, '0');
      const D = dateParts[2].padStart(2, '0');
      const timeParts = parts[1].split(':');
      const h = timeParts[0].padStart(2, '0');
      const m = timeParts[1].padStart(2, '0');
      date = `${Y}-${M}-${D}T${h}:${m}`;
      break;
    }
  }

  // 2. Location: Between Date and Address/統編
  let addrLineIdx = lines.findIndex(l => l.includes('地址') || l.includes('統編') || l.includes('營業人'));
  if (dateLineIdx !== -1 && addrLineIdx !== -1 && addrLineIdx > dateLineIdx) {
    for (let i = dateLineIdx + 1; i < addrLineIdx; i++) {
       const l = lines[i];
       // Filter out cloud invoice/carrier labels
       if (!l.includes('雲端發票') && 
           !l.includes('載具') && 
           !l.includes('條碼') && 
           !l.includes('OPEN POINT') &&
           l.length > 1) {
          location = l.replace(/\s+/g, ''); // Remove inner spaces like '統 一 超 商'
          break;
       }
    }
  } else if (addrLineIdx > 0) {
    // Fallback if date wasn't found but address was
    let loc = lines[addrLineIdx - 1];
    if (!loc.includes('雲端') && !loc.includes('發票')) {
       location = loc.replace(/\s+/g, '');
    }
  }

  // 3. Total Amount: "合計 90" or "合計 xxx"
  // Handle spaces inside numbers due to OCR spacing
  const amountRegex = /合計\s*[:：]?\s*([0-9\s,]+)/i;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(amountRegex);
    if (match) {
      const numStr = match[1].replace(/[\s,]/g, '');
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed)) {
        totalAmount = parsed;
      }
      break;
    }
  }

  // 4. Details: Between "品名" (or similar header) and "共 X 項"
  let startIdx = lines.findIndex(l => l.includes('品名') || l.includes('數量') || l.includes('小計'));
  let endIdx = lines.findIndex(l => l.includes('共') && l.includes('項') && /\d/.test(l));
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
     details = lines.slice(startIdx + 1, endIdx).join('\n');
  } else if (endIdx !== -1 && addrLineIdx !== -1 && endIdx > addrLineIdx) {
     // Fallback: items are somewhere after address and before "共X項"
     // Usually there's an empty gap, but lines contains only non-empty
     details = lines.slice(addrLineIdx + 1, endIdx).filter(l => !l.includes('統編') && !l.includes('地址') && !l.includes('品名')).join('\n');
  }

  const errors: string[] = [];
  if (totalAmount === undefined) errors.push('金額');
  if (!location) errors.push('店家名稱');
  if (!date) errors.push('日期');
  if (!details) errors.push('消費品項');

  const incomplete = errors.length > 0;

  return {
    date,
    location,
    totalAmount,
    details,
    incomplete,
    errors,
    rawText: ocrText
  };
}
