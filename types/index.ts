export type TransactionType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  isCustom: boolean;
  order: number;
}

export type PaymentMethodType = 'bank' | 'epay' | 'card' | 'cash';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  brandId?: string; // ID of the predefined brand (e.g. 'google-pay', 'apple-pay')
  customIconUrl?: string; // We won't use it for now as per requirements, but good to have
  notes?: string;
  isDefault?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  baseAmount: number; // Amount in base currency (e.g., TWD) if multi-currency is used
  currency: string;
  exchangeRate: number;
  categoryId: string;
  paymentMethodId: string;
  date: number; // Unix timestamp
  notes: string;
  invoiceId?: string; // Link to the scanned/imported invoice
  createdAt: number;
  updatedAt: number;
}

export type InvoiceType = 'cloud' | 'paper'; // cloud = 載具發票, paper = 紙本發票(電子發票QR Code)

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string; // The invoice number (e.g., AB12345678)
  userId: string;
  type: InvoiceType;
  date: number; // Unix timestamp
  sellerId: string;
  sellerName?: string;
  totalAmount: number;
  randomNumber: string; // 4-digit random code
  items: InvoiceItem[];
  isLinkedToTransaction: boolean;
  createdAt: number;
}

export interface Budget {
  id: string; // e.g., userId_month_categoryId
  userId: string;
  amount: number;
  period: 'daily' | 'monthly';
  month: string; // e.g., '2024-05'
  categoryId?: string; // Optional, if not provided it's the total budget
}

export interface SavingGoal {
  id: string;
  userId: string;
  name: string;             // Name (e.g. Travel, First Pot of Gold)
  targetAmount: number;     // Target amount
  currentAmount: number;    // Current saved amount
  targetDate: number;       // Target date (Unix timestamp)
  reminderFrequency: 'daily' | 'weekly' | 'monthly' | 'none'; // Reminder frequency
  isFixedAmount: boolean;   // Whether it is a regular fixed amount saving
  fixedAmountValue?: number; // Regular fixed amount value
  createdAt: number;
}

export interface UserSettings {
  userId: string;
  baseCurrency: string;
  theme: 'light' | 'dark' | 'system';
  promptToRecordAfterScan: boolean;
  biometricEnabled: boolean;
}
