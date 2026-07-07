export const PREDEFINED_BANKS = [
  { id: 'ctbc', name: '中國信託' },
  { id: 'esun', name: '玉山銀行' },
  { id: 'cathay', name: '國泰世華' },
  { id: 'fubon', name: '台北富邦' },
  { id: 'taishin', name: '台新銀行' },
  { id: 'bot', name: '臺灣銀行' },
  { id: 'mega', name: '兆豐銀行' },
  { id: 'post', name: '中華郵政' },
  { id: 'amex', name: '美國運通' },
];

export const PREDEFINED_EPAYS = [
  { id: 'linepay', name: 'LINE Pay' },
  { id: 'jkopay', name: '街口支付' },
  { id: 'taiwanpay', name: '台灣 Pay' },
  { id: 'applepay', name: 'Apple Pay' },
  { id: 'googlepay', name: 'Google Pay' },
  { id: 'samsungpay', name: 'Samsung Pay' },
  { id: 'garminpay', name: 'Garmin Pay' },
  { id: 'easywallet', name: '悠遊付' },
  { id: 'icashpay', name: 'icash Pay' },
  { id: 'ipassmoney', name: 'iPASS MONEY' },
  { id: 'pxpay', name: '全支付' },
  { id: 'piwallet', name: 'Pi 拍錢包' },
  { id: 'famiplus', name: '全盈+PAY' },
  { id: 'linepaymoney', name: '一卡通MONEY' },
  { id: 'zingala', name: 'zingala 銀角零卡' },
  { id: 'paypal', name: 'PayPal' },
];

export const PREDEFINED_CARDS = [
  { id: 'easycard', name: '悠遊卡' },
  { id: 'ipass', name: '一卡通' },
  { id: 'icash', name: 'icash 2.0' },
];

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: '餐飲', type: 'expense', icon: 'utensils', isCustom: false },
  { id: 'transport', name: '交通', type: 'expense', icon: 'train', isCustom: false },
  { id: 'shopping', name: '購物', type: 'expense', icon: 'shopping-bag', isCustom: false },
  { id: 'entertainment', name: '娛樂', type: 'expense', icon: 'film', isCustom: false },
  { id: 'bills', name: '帳單與水電', type: 'expense', icon: 'zap', isCustom: false },
  { id: 'health', name: '醫療與健康', type: 'expense', icon: 'heart', isCustom: false },

  { id: 'salary', name: '薪資', type: 'income', icon: 'banknote', isCustom: false },
  { id: 'investment', name: '投資', type: 'income', icon: 'trending-up', isCustom: false },
  { id: 'other_income', name: '其他收入', type: 'income', icon: 'plus-circle', isCustom: false },
];
