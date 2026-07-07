export const PREDEFINED_BANKS = [
  { id: 'ctbc', name: '中國信託 (CTBC)' },
  { id: 'esun', name: '玉山銀行 (E.SUN)' },
  { id: 'cathay', name: '國泰世華 (Cathay)' },
  { id: 'fubon', name: '台北富邦 (Fubon)' },
  { id: 'taishin', name: '台薪銀行 (Taishin)' },
  { id: 'bot', name: '臺灣銀行 (BOT)' },
  { id: 'mega', name: '兆豐銀行 (Mega)' },
  { id: 'post', name: '中華郵政 (Chunghwa Post)' },
  { id: 'amex', name: '美國運通 (American Express)' },
];

export const PREDEFINED_EPAYS = [
  { id: 'linepay', name: 'Line Pay' },
  { id: 'jkopay', name: '街口支付 (JKO Pay)' },
  { id: 'taiwanpay', name: '臺灣 Pay' },
  { id: 'applepay', name: 'Apple Pay' },
  { id: 'googlepay', name: 'Google Pay' },
  { id: 'samsungpay', name: 'Samsung Pay' },
  { id: 'garminpay', name: 'Garmin Pay' },
  { id: 'easywallet', name: '悠遊付 (Easy Wallet)' },
  { id: 'icashpay', name: 'icash Pay' },
  { id: 'ipassmoney', name: 'iPASS MONEY' },
  { id: 'pxpay', name: '全支付 (PxPay Plus)' },
  { id: 'piwallet', name: 'Pi 拍錢包' },
  { id: 'famiplus', name: '全盈+PAY' },
  { id: 'linepaymoney', name: '一卡通MONEY' },
  { id: 'zingala', name: 'zingala 銀角零卡' },
  { id: 'paypal', name: 'PayPal' },
];

export const PREDEFINED_CARDS = [
  { id: 'easycard', name: '悠遊卡 (EasyCard)' },
  { id: 'ipass', name: '一卡通 (iPASS)' },
  { id: 'icash', name: 'icash 2.0' },
];

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', type: 'expense', icon: 'utensils', isCustom: false },
  { id: 'transport', name: 'Transportation', type: 'expense', icon: 'train', isCustom: false },
  { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag', isCustom: false },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'film', isCustom: false },
  { id: 'bills', name: 'Bills & Utilities', type: 'expense', icon: 'zap', isCustom: false },
  { id: 'health', name: 'Health & Fitness', type: 'expense', icon: 'heart', isCustom: false },

  { id: 'salary', name: 'Salary', type: 'income', icon: 'banknote', isCustom: false },
  { id: 'investment', name: 'Investment', type: 'income', icon: 'trending-up', isCustom: false },
  { id: 'other_income', name: 'Other Income', type: 'income', icon: 'plus-circle', isCustom: false },
];
