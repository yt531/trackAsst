import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptFromWords, parseMOFReceipt, type OcrWord } from '../lib/receipt-parser.ts';

// 解析器會 console.log 每一列，測試輸出會被洗版，這裡靜音
console.log = () => {};
console.warn = () => {};

// ---- 測試用的版面工具：每列固定 50px 間距、字高 30px，用 x 座標模擬欄位 ----
type W = [text: string, x0: number, x1: number, confidence?: number];
const layout = (rows: W[][]): OcrWord[] =>
  rows.flatMap((row, i) =>
    row.map(([text, x0, x1, confidence = 90]) => ({
      text,
      confidence,
      bbox: { x0, x1, y0: i * 50, y1: i * 50 + 30 },
    })),
  );

// 欄位位置：品名 x<300、數量約 400、小計約 600
const HEADER: W[] = [['品名', 50, 120], ['數量', 380, 450], ['小計', 560, 630]];
const item = (name: string, qty: string, sub: string): W[] => [
  [name, 50, 200], [qty, 390, 430], [sub, 580, 620],
];
const top: W[][] = [
  [['統一超商', 50, 250]],
  [['2026/01/05', 50, 200], ['09:03:07', 210, 330]],
  [['EZ23446726', 50, 250]],
  HEADER,
];
const footer = (count: number, total: number): W[] => [
  ['共', 50, 70], [String(count), 80, 100], ['項', 110, 130], ['合計', 400, 470], [String(total), 560, 620],
];

describe('parseReceiptFromWords：基本欄位', () => {
  const result = parseReceiptFromWords(layout([
    ...top,
    item('牛奶', 'x2', '100'),
    item('麵包', 'x1', '50'),
    footer(2, 150),
  ]));

  test('正確抓出日期、發票號碼、店名、合計', () => {
    assert.equal(result.date, '2026-01-05T09:03');
    assert.equal(result.invoiceNumber, 'EZ23446726');
    assert.equal(result.location, '統一超商');
    assert.equal(result.totalAmount, 150);
  });

  test('品項依欄位位置拆成品名／數量／小計', () => {
    assert.deepEqual(result.items, [
      { name: '牛奶', quantity: 2, subtotal: 100 },
      { name: '麵包', quantity: 1, subtotal: 50 },
    ]);
  });

  test('全部欄位都齊全時不標記為 incomplete', () => {
    assert.equal(result.incomplete, false);
    assert.equal(result.errors, undefined);
  });
});

describe('parseReceiptFromWords：OCR 常見錯誤的容錯', () => {
  // WHY：折扣金額若被讀成正數，記帳金額就會錯，使用者很難發現
  test('負號被拆成獨立的 "-" 與 "6" 時，仍能還原成 -6', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      item('牛奶', 'x1', '100'),
      [['折扣', 50, 150], ['x1', 390, 430], ['-', 570, 580, 10], ['6', 590, 620]],
      footer(2, 94),
    ]));
    assert.equal(r.items?.[1].subtotal, -6);
    assert.equal(r.incomplete, false);
  });

  // WHY：單獨負號信心度常低於門檻，若被當雜訊丟掉折扣就會變成正數
  test('信心度很低的單獨負號不會被過濾掉', () => {
    // 另放一個 +6 的品項，讓「漏掉負號自動補回」的備援無法唯一判定，
    // 這樣只有真的保留負號才會得到 -6
    const r = parseReceiptFromWords(layout([
      ...top,
      item('牛奶', 'x1', '100'),
      item('零食', 'x1', '6'),
      [['折扣', 50, 150], ['x1', 390, 430], ['-', 570, 580, 5], ['6', 590, 620]],
      footer(3, 100),
    ]));
    assert.deepEqual(r.items?.map(i => i.subtotal), [100, 6, -6]);
    assert.equal(r.incomplete, false);
  });

  test('一般信心度過低（<=30）的雜訊字會被丟掉', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      [['牛奶', 50, 200], ['鬼影', 220, 260, 10], ['x1', 390, 430], ['100', 580, 620]],
      footer(1, 100),
    ]));
    assert.equal(r.items?.[0].name, '牛奶');
  });

  // WHY：負號完全漏掉時，只有「恰好一個品項翻成負數就能對上合計」才敢自動修正
  test('負號整個漏掉時，若只有一個品項能讓加總對上合計，就自動補回負號', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      item('牛奶', 'x1', '100'),
      item('折扣', 'x1', '6'),
      footer(2, 94),
    ]));
    assert.equal(r.items?.[1].subtotal, -6);
    assert.equal(r.incomplete, false);
  });

  // WHY：有兩個以上候選時猜錯會悄悄寫入錯誤金額，寧可提示使用者檢查
  test('有多個候選品項時不亂猜，改回報加總不符', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      item('牛奶', 'x1', '100'),
      item('折扣A', 'x1', '6'),
      item('折扣B', 'x1', '6'),
      footer(3, 100),
    ]));
    assert.deepEqual(r.items?.map(i => i.subtotal), [100, 6, 6]);
    assert.ok(r.errors?.some(e => e.includes('小計加總（112）與合計（100）不符')));
    assert.equal(r.incomplete, true);
  });

  test('數量的 OCR 誤判：x 後面的 l 讀成 1，全形 ×、ｘ 也能辨識', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      item('甲', 'xl', '10'),
      item('乙', '×3', '30'),
      item('丙', 'ｘ２', '20'),
      footer(3, 60),
    ]));
    assert.deepEqual(r.items?.map(i => i.quantity), [1, 3, 2]);
  });

  // WHY：數量被拆成 "x" 與 "2" 兩個詞是實際發生過的辨識結果
  test('數量被拆成 "x" 與 "2" 兩個詞時，整欄合併後解析', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      [['牛奶', 50, 200], ['x', 390, 400], ['2', 410, 430], ['100', 580, 620]],
      footer(1, 100),
    ]));
    assert.equal(r.items?.[0].quantity, 2);
  });

  test('品名中被 OCR 插入空白的中文字會接回去', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      [['無', 50, 70], ['糖', 80, 100], ['綠', 110, 130], ['茶', 140, 160], ['x1', 390, 430], ['30', 580, 620]],
      footer(1, 30),
    ]));
    assert.equal(r.items?.[0].name, '無糖綠茶');
  });

  // WHY：實際發票的表頭常被讀成「品名數量小計」一個詞，必須從字元位置推算欄位 X
  test('表頭被讀成單一個詞時，依字元位置內插出欄位邊界', () => {
    const r = parseReceiptFromWords(layout([
      [['統一超商', 50, 250]],
      [['2026/01/05', 50, 200], ['09:03:07', 210, 330]],
      [['品名數量小計', 50, 650]], // 數 約在 x250、小 約在 x450
      [['牛奶', 50, 150], ['x2', 280, 320], ['100', 520, 580]],
      footer(1, 100),
    ]));
    assert.deepEqual(r.items, [{ name: '牛奶', quantity: 2, subtotal: 100 }]);
  });
});

describe('parseReceiptFromWords：品名換行與驗證', () => {
  test('沒有數量也沒有小計的列視為上一個品名的延續', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      item('特級純天然', 'x1', '120'),
      [['冷壓橄欖油', 50, 200]],
      footer(1, 120),
    ]));
    assert.equal(r.items?.length, 1);
    assert.equal(r.items?.[0].name, '特級純天然冷壓橄欖油');
  });

  // WHY：「共 N 項」是少數可以交叉驗證辨識有沒有漏列的線索
  test('品項數與「共 N 項」不符時回報錯誤', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      item('牛奶', 'x1', '100'),
      item('麵包', 'x1', '50'),
      footer(3, 150),
    ]));
    assert.ok(r.errors?.includes('品項數不符（預期 3，辨識到 2）'));
    assert.equal(r.incomplete, true);
  });

  test('小計加總與合計對不上且無法修正時，回報金額不符', () => {
    const r = parseReceiptFromWords(layout([
      ...top,
      item('牛奶', 'x1', '100'),
      item('麵包', 'x1', '50'),
      footer(2, 999),
    ]));
    assert.ok(r.errors?.includes('小計加總（150）與合計（999）不符'));
    assert.equal(r.incomplete, true);
  });
});

describe('parseReceiptFromWords：欄位擷取細節', () => {
  test('日期的月、日、時補零成 datetime-local 格式', () => {
    const r = parseReceiptFromWords(layout([[['2026/1/5', 50, 150], ['9:03:07', 160, 260]]]));
    assert.equal(r.date, '2026-01-05T09:03');
  });

  test('店名含全形字元時轉半形並去掉空白', () => {
    const r = parseReceiptFromWords(layout([[['７-ＥＬＥＶＥＮ', 50, 300], ['中山店', 310, 400]]]));
    assert.equal(r.location, '7-ELEVEN中山店');
  });

  test('不在已知店名清單時，取日期與地址列之間的那一列當店名', () => {
    const r = parseReceiptFromWords(layout([
      [['2026/01/05', 50, 200], ['09:03:07', 210, 330]],
      [['雲端發票', 50, 200]],
      [['阿明', 50, 120], ['小吃店', 130, 220]],
      [['營業人', 50, 120], ['地址', 130, 200]],
    ]));
    assert.equal(r.location, '阿明小吃店');
  });

  test('Y 座標略有誤差的字仍歸在同一列', () => {
    const words: OcrWord[] = [
      { text: '合計', confidence: 90, bbox: { x0: 50, x1: 120, y0: 0, y1: 30 } },
      { text: '88', confidence: 90, bbox: { x0: 130, x1: 180, y0: 6, y1: 36 } },
    ];
    assert.equal(parseReceiptFromWords(words).totalAmount, 88);
  });

  test('沒有「共 N 項」時，仍可從任一列的「合計」取得金額', () => {
    const r = parseReceiptFromWords(layout([[['合計:', 50, 120], ['1,250', 130, 220]]]));
    assert.equal(r.totalAmount, 1250);
  });
});

describe('parseReceiptFromWords：資料不足時', () => {
  test('沒有任何文字時回傳 incomplete，並列出缺少的欄位', () => {
    const r = parseReceiptFromWords([]);
    assert.equal(r.incomplete, true);
    assert.deepEqual(r.errors, ['金額', '交易地點', '日期', '交易明細']);
    assert.equal(r.items, undefined);
  });
});

describe('parseMOFReceipt（純文字備援）', () => {
  const text = [
    'EZ23446726',
    '2026/1/5 09:03:07',
    '大安門市',
    '營業人地址 台北市',
    '合計: 1,250',
  ].join('\n');

  test('從純文字抓出發票號碼、日期、店名、合計', () => {
    const r = parseMOFReceipt(text);
    assert.equal(r.invoiceNumber, 'EZ23446726');
    assert.equal(r.date, '2026-01-05T09:03');
    assert.equal(r.location, '大安門市');
    assert.equal(r.totalAmount, 1250);
    assert.equal(r.incomplete, false);
  });

  test('缺少欄位時列出錯誤', () => {
    const r = parseMOFReceipt('隨便一行文字');
    assert.equal(r.incomplete, true);
    assert.deepEqual(r.errors, ['金額', '交易地點', '日期']);
  });
});
