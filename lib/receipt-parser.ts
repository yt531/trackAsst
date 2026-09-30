/**
 * Receipt parser using coordinate-based approach.
 * 
 * Instead of parsing raw OCR text with regex, this parser uses
 * word-level bounding box data from Tesseract.js to:
 * 1. Group words into rows by Y coordinate
 * 2. Identify table header/footer by content
 * 3. Map columns by X coordinate (品名, 數量, 小計)
 * 4. Handle multi-line product names
 * 5. Extract store name, invoice number, date, total
 * 6. Validate item count against "共 N 項"
 */

import type { TransactionItem } from '@/types';

// ---------- Types ----------

export interface ScannedReceiptResult {
  date?: string;           // YYYY-MM-DDThh:mm format for datetime-local
  location?: string;       // Store name (交易地點)
  totalAmount?: number;    // 合計
  invoiceNumber?: string;  // 發票號碼 e.g. EZ23446726
  items?: TransactionItem[];
  incomplete: boolean;
  errors?: string[];
  rawText?: string;
}

/** Word-level OCR data from Tesseract.js */
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** A row of words grouped by Y coordinate */
interface WordRow {
  words: OcrWord[];
  centerY: number;
  text: string; // joined text for the row
}

// ---------- Helpers ----------

/** Remove spaces between CJK characters (common OCR artifact) */
function cjkJoin(text: string): string {
  return text.replace(/(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '');
}

/** Normalize full-width characters to half-width (for store names) */
function normalizeFullWidth(text: string): string {
  return text.replace(/[\uff01-\uff5e]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  ).replace(/\u3000/g, ' ');
}

/** Normalize various dash/minus characters to standard hyphen-minus */
const NEG_MAP: Record<string, string> = { '−': '-', '—': '-', '–': '-', '一': '-', '―': '-' };
function normalizeNegative(text: string): string {
  return text.replace(/[−—–一―]/g, (ch) => NEG_MAP[ch] || ch);
}

/** Parse a quantity string like "x2", "X1", "×3" into a number */
function parseQuantity(text: string): number | null {
  const m = text.trim().match(/^[xX×]\s*(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/** Parse a number string (possibly negative) */
function parseNumber(text: string): number | null {
  const cleaned = normalizeNegative(text).replace(/[,\s]/g, '');
  const m = cleaned.match(/^-?\d+$/);
  return m ? parseInt(cleaned, 10) : null;
}

// ---------- Row Grouping ----------

/**
 * Group words into rows based on Y coordinate proximity.
 * Uses median word height * 0.6 as tolerance.
 */
function groupWordsIntoRows(words: OcrWord[]): WordRow[] {
  if (words.length === 0) return [];

  // Filter out empty/whitespace-only words and low confidence
  const filtered = words.filter(w => {
    const text = w.text.trim();
    return text.length > 0 && w.confidence > 30;
  });

  if (filtered.length === 0) return [];

  // Sort by Y center
  const sorted = [...filtered].sort((a, b) => {
    const aCenter = (a.bbox.y0 + a.bbox.y1) / 2;
    const bCenter = (b.bbox.y0 + b.bbox.y1) / 2;
    return aCenter - bCenter;
  });

  // Calculate median height for tolerance
  const heights = sorted.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 20;
  const tolerance = medianHeight * 0.6;

  // Group
  const rows: OcrWord[][] = [];
  let currentRow: OcrWord[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevCenter = (currentRow[currentRow.length - 1].bbox.y0 + currentRow[currentRow.length - 1].bbox.y1) / 2;
    const currCenter = (sorted[i].bbox.y0 + sorted[i].bbox.y1) / 2;

    if (Math.abs(currCenter - prevCenter) > tolerance) {
      rows.push(currentRow);
      currentRow = [sorted[i]];
    } else {
      currentRow.push(sorted[i]);
    }
  }
  rows.push(currentRow);

  // Sort words within each row by X, and compute row text
  return rows.map(rowWords => {
    const sortedByX = rowWords.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const centerY = sortedByX.reduce((sum, w) => sum + (w.bbox.y0 + w.bbox.y1) / 2, 0) / sortedByX.length;
    const text = cjkJoin(sortedByX.map(w => w.text.trim()).join(' '));
    return { words: sortedByX, centerY, text };
  });
}

// ---------- Main Parser ----------

/**
 * Parse receipt from Tesseract.js word-level data.
 * This is the coordinate-based approach recommended by the reference material.
 */
export function parseReceiptFromWords(words: OcrWord[]): ScannedReceiptResult {
  const rows = groupWordsIntoRows(words);
  const errors: string[] = [];

  console.log('[OCR Parser] Grouped into', rows.length, 'rows');
  console.log('[OCR Parser] Row texts:', rows.map((r, i) => `  [${i}] ${r.text}`).join('\n'));

  // ---------- Extract Invoice Number ----------
  // Format: 2 uppercase letters + 8 digits, e.g. EZ23446726
  let invoiceNumber: string | undefined;
  for (const row of rows) {
    const m = row.text.match(/([A-Z]{2}\d{8})/);
    if (m) {
      invoiceNumber = m[1];
      break;
    }
  }

  // ---------- Extract Date ----------
  // Format: YYYY/M/D H:mm:ss or similar
  let date: string | undefined;
  const dateRegex = /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
  for (const row of rows) {
    const m = row.text.match(dateRegex);
    if (m) {
      const Y = m[1];
      const M = m[2].padStart(2, '0');
      const D = m[3].padStart(2, '0');
      const h = m[4].padStart(2, '0');
      const min = m[5].padStart(2, '0');
      date = `${Y}-${M}-${D}T${h}:${min}`;
      break;
    }
  }

  // ---------- Extract Store Name (交易地點) ----------
  let location: string | undefined;

  // Strategy 1: Find row starting with known patterns
  const storePatterns = [
    '統一超商', '全家便利', '萊爾富', 'OK超商', 'OK便利',
    '7-ELEVEN', '全聯', '家樂福', '好市多', 'Costco',
    '美廉社', '大潤發', '愛買', '屈臣氏', '康是美',
    '寶雅', '小北', '頂好', '楓康', '遠百', '新光',
    '大統', '漢神', '微風', '誠品', '金石堂',
    '麥當勞', '肯德基', 'KFC', '摩斯漢堡', 'MOS',
    '星巴克', 'Starbucks', '路易莎', 'Louisa',
    '王品', '瓦城', '鼎泰豐', '爭鮮', '藏壽司',
  ];

  for (const row of rows) {
    const normalizedText = normalizeFullWidth(row.text);
    // Check if row contains known store pattern
    if (storePatterns.some(p => normalizedText.includes(p))) {
      location = normalizedText.replace(/\s+/g, '');
      break;
    }
  }

  // Strategy 2: If not found, look for row between date and address/統編
  if (!location) {
    const dateRowIdx = rows.findIndex(r => dateRegex.test(r.text));
    const addrRowIdx = rows.findIndex(r =>
      r.text.includes('地址') || r.text.includes('統編') || r.text.includes('營業人')
    );

    if (dateRowIdx !== -1 && addrRowIdx !== -1 && addrRowIdx > dateRowIdx) {
      for (let i = dateRowIdx + 1; i < addrRowIdx; i++) {
        const t = rows[i].text;
        if (!t.includes('雲端') && !t.includes('載具') && !t.includes('OPEN') && !t.includes('條碼') && t.length > 1) {
          location = normalizeFullWidth(t).replace(/\s+/g, '');
          break;
        }
      }
    } else if (addrRowIdx > 0) {
      // Fallback: row just before address
      const t = rows[addrRowIdx - 1].text;
      if (!t.includes('雲端') && !t.includes('發票') && t.length > 2) {
        location = normalizeFullWidth(t).replace(/\s+/g, '');
      }
    }
  }

  // Strategy 3: Look for company pattern (XX股份有限公司)
  if (!location) {
    for (const row of rows) {
      if (/股份有限公司/.test(row.text) || /有限公司/.test(row.text)) {
        location = normalizeFullWidth(row.text).replace(/\s+/g, '');
        break;
      }
    }
  }

  // ---------- Find Table Header & Footer ----------
  // Header: row containing "品名"
  const headerIdx = rows.findIndex(r =>
    r.text.includes('品名') && (r.text.includes('數量') || r.text.includes('小計'))
  );

  // If header not found, try a looser match
  const headerIdxLoose = headerIdx !== -1 ? headerIdx : rows.findIndex(r => r.text.includes('品名'));

  // Footer: row containing "共 N 項"
  const footerIdx = rows.findIndex(r => /共\s*\d+\s*項/.test(r.text));

  // ---------- Extract Total Amount ----------
  let totalAmount: number | undefined;
  let expectedItemCount: number | undefined;

  // Try from footer row first
  if (footerIdx !== -1) {
    const footerText = normalizeNegative(rows[footerIdx].text);
    const countMatch = footerText.match(/共\s*(\d+)\s*項/);
    if (countMatch) expectedItemCount = parseInt(countMatch[1], 10);

    const totalMatch = footerText.match(/合計\s*(-?\d+)/);
    if (totalMatch) totalAmount = parseInt(totalMatch[1], 10);
  }

  // If total not found in footer, search all rows for "合計"
  if (totalAmount === undefined) {
    for (const row of rows) {
      const t = normalizeNegative(row.text);
      const m = t.match(/合計\s*[:：]?\s*(-?\d[\d,]*)/);
      if (m) {
        totalAmount = parseInt(m[1].replace(/,/g, ''), 10);
        break;
      }
    }
  }

  // ---------- Parse Items ----------
  let items: TransactionItem[] | undefined;

  const effectiveHeaderIdx = headerIdxLoose !== -1 ? headerIdxLoose : -1;
  const effectiveFooterIdx = footerIdx !== -1 ? footerIdx : rows.length;

  if (effectiveHeaderIdx !== -1 && effectiveFooterIdx > effectiveHeaderIdx + 1) {
    // Determine column X boundaries from the header row
    const headerRow = rows[effectiveHeaderIdx];

    // Find the X position of "數量" and "小計" in the header
    let qtyHeaderX: number | null = null;
    let subHeaderX: number | null = null;

    for (const w of headerRow.words) {
      if (w.text.includes('數') || w.text.includes('數量')) {
        qtyHeaderX = w.bbox.x0;
      }
      if (w.text.includes('小') || w.text.includes('小計')) {
        subHeaderX = w.bbox.x0;
      }
    }

    console.log('[OCR Parser] Column positions:', { qtyHeaderX, subHeaderX });

    if (qtyHeaderX !== null && subHeaderX !== null) {
      items = [];
      const dataRows = rows.slice(effectiveHeaderIdx + 1, effectiveFooterIdx);

      for (const row of dataRows) {
        // Classify words into columns based on X position
        const nameWords: string[] = [];
        let quantity: number | null = null;
        let subtotal: number | null = null;

        for (const w of row.words) {
          const wordCenterX = (w.bbox.x0 + w.bbox.x1) / 2;
          const text = w.text.trim();

          if (wordCenterX >= subHeaderX - 20) {
            // Subtotal column (rightmost)
            const num = parseNumber(text);
            if (num !== null) subtotal = num;
          } else if (wordCenterX >= qtyHeaderX - 20) {
            // Quantity column
            const qty = parseQuantity(text);
            if (qty !== null) {
              quantity = qty;
            } else {
              // Might be a number without 'x' prefix
              const num = parseNumber(text);
              if (num !== null && !text.startsWith('-')) {
                quantity = num;
              }
            }
          } else {
            // Product name column
            nameWords.push(text);
          }
        }

        const name = cjkJoin(nameWords.join(' ')).trim();

        // If this row has no quantity and no subtotal, it's a continuation line
        if (quantity === null && subtotal === null && items.length > 0 && name) {
          items[items.length - 1].name += name;
          console.log('[OCR Parser] Multi-line merge:', items[items.length - 1].name);
        } else if (name) {
          items.push({
            name,
            quantity: quantity ?? 1,
            subtotal: subtotal ?? 0,
          });
        }
      }

      console.log('[OCR Parser] Parsed items:', items);

      // Validate item count
      if (expectedItemCount !== undefined && items.length !== expectedItemCount) {
        console.warn(`[OCR Parser] Item count mismatch: expected ${expectedItemCount}, got ${items.length}`);
        errors.push(`品項數不符（預期 ${expectedItemCount}，辨識到 ${items.length}）`);
      }
    } else {
      console.warn('[OCR Parser] Could not determine column positions from header');
      errors.push('無法辨識表格欄位位置');
    }
  } else {
    console.warn('[OCR Parser] Could not find table header or footer');
  }

  // ---------- Collect Errors ----------
  if (totalAmount === undefined) errors.push('金額');
  if (!location) errors.push('交易地點');
  if (!date) errors.push('日期');
  if (!items || items.length === 0) errors.push('交易明細');

  const incomplete = errors.length > 0;

  return {
    date,
    location,
    totalAmount,
    invoiceNumber,
    items: items && items.length > 0 ? items : undefined,
    incomplete,
    errors: errors.length > 0 ? errors : undefined,
    rawText: rows.map(r => r.text).join('\n'),
  };
}

// ---------- Legacy fallback: parse from raw text ----------
// Used as fallback when word-level data is not available

export function parseMOFReceipt(ocrText: string): ScannedReceiptResult {
  const normalizedText = ocrText
    .replace(/O/g, '0')
    .replace(/／/g, '/');

  const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let date: string | undefined;
  let location: string | undefined;
  let totalAmount: number | undefined;
  let invoiceNumber: string | undefined;

  // Invoice number
  for (const line of lines) {
    const m = line.match(/([A-Z]{2}\d{8})/);
    if (m) { invoiceNumber = m[1]; break; }
  }

  // Date
  const dateRegex = /(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2})/;
  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      const parts = match[1].split(/\s+/);
      const [Y, M, D] = parts[0].split('/');
      const [h, m] = parts[1].split(':');
      date = `${Y}-${M.padStart(2, '0')}-${D.padStart(2, '0')}T${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      break;
    }
  }

  // Location
  const addrLineIdx = lines.findIndex(l => l.includes('地址') || l.includes('統編') || l.includes('營業人'));
  const dateLineIdx = lines.findIndex(l => dateRegex.test(l));
  if (dateLineIdx !== -1 && addrLineIdx !== -1 && addrLineIdx > dateLineIdx) {
    for (let i = dateLineIdx + 1; i < addrLineIdx; i++) {
      const l = lines[i];
      if (!l.includes('雲端發票') && !l.includes('載具') && !l.includes('條碼') && !l.includes('OPEN POINT') && l.length > 1) {
        location = l.replace(/\s+/g, '');
        break;
      }
    }
  }

  // Total amount
  const amountRegex = /合計\s*[:：]?\s*([0-9\s,]+)/i;
  for (const line of lines) {
    const match = line.match(amountRegex);
    if (match) {
      const numStr = match[1].replace(/[\s,]/g, '');
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed)) totalAmount = parsed;
      break;
    }
  }

  const errors: string[] = [];
  if (totalAmount === undefined) errors.push('金額');
  if (!location) errors.push('交易地點');
  if (!date) errors.push('日期');

  return {
    date,
    location,
    totalAmount,
    invoiceNumber,
    incomplete: errors.length > 0,
    errors: errors.length > 0 ? errors : undefined,
    rawText: ocrText,
  };
}
