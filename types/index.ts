export type TransactionType = 'expense' | 'income' | 'settlement';

export interface Category {
  id: string;
  ledgerId?: string;
  name: string;
  type: TransactionType;
  icon: string;
  isCustom: boolean;
  order: number;
  isDeleted?: boolean;
  createdBy?: string;
}

export type PaymentMethodType = 'bank' | 'epay' | 'card' | 'cash' | 'unset';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  name: string;
  brandId?: string; // ID of the predefined brand (e.g. 'google-pay', 'apple-pay')
  customIconUrl?: string; // We won't use it for now as per requirements, but good to have
  notes?: string;
  isDefault?: boolean;
  order?: number;
  isSystem?: boolean;
}

export interface TransactionSplit {
  userId: string;
  paidAmount: number;
  owedAmount: number;
}

export interface Transaction {
  id: string;
  ledgerId?: string;
  userId: string;
  type: TransactionType;
  amount: number;
  baseAmount: number; // Amount in base currency (e.g., TWD) if multi-currency is used
  currency: string;
  exchangeRate: number;
  categoryId: string;
  paymentMethodId: string;
  date: number; // Unix timestamp
  details: string;
  notes?: string;
  invoiceId?: string; // Link to the scanned/imported invoice
  tagIds?: string[];
  splits?: TransactionSplit[];
  isAdvancePayment?: boolean;
  advancePaymentStatus?: 'unsettled' | 'settled';
  settledTransactionId?: string; // ID of the transaction that settled this advance payment
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
  notes?: string; // User added remarks/notes for the invoice details
  isLinkedToTransaction: boolean;
  createdAt: number;
}

export interface Budget {
  id: string; // e.g., userId_month_categoryId
  userId: string;
  ledgerId?: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  month: string; // e.g., '2024-05' or '2024' for yearly
  categoryId?: string; // Optional, if not provided it's the total budget
  order?: number;
  categoryRules?: Record<string, 'deduction' | 'addition' | 'none'>; // Rules for total budget calculation
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
  order?: number;           // Sorting order
  createdAt: number;
}

export interface SavingRecord {
  id: string;
  amount: number;
  date: number;
  note?: string;
}

export interface UserSettings {
  userId: string;
  baseCurrency: string;
  theme: 'light' | 'dark' | 'system';
  promptToRecordAfterScan: boolean;
  biometricEnabled: boolean;
  calendarSyncEnabled?: boolean;
  defaultPrivacyLevel?: number;
  homePrivacyLevel?: number;
  transactionsPrivacyLevel?: number;
  ledgerPrivacyLevel?: number;
  allowScreenshot?: boolean;
  personalVisibleBudgetPeriods?: ('daily' | 'weekly' | 'monthly' | 'yearly')[];
  ledgerVisibleBudgetPeriods?: Record<string, ('daily' | 'weekly' | 'monthly' | 'yearly')[]>;
}

export interface Tag {
  id: string;
  ledgerId?: string;
  userId: string;
  name: string;
  order?: number;
  createdAt: number;
  createdBy?: string;
}

export type LedgerMode = 'shared_fund' | 'split';

export interface LedgerFundSettings {
  memberTargetAmount?: number;
  contributionPeriod?: 'monthly' | 'yearly' | 'one-time';
}

export interface Ledger {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  mode?: LedgerMode;
  currency: string;
  createdAt: number;
  createdBy: string;
  feedHiddenUntil?: number;
  settings: {
    allowMembersToCreateCategories: boolean;
    allowMembersToCreateTags: boolean;
  };
  fundSettings?: LedgerFundSettings;
}

export type LedgerRole = 'admin' | 'vice_admin' | 'editor' | 'viewer';

export interface LedgerMember {
  id: string;
  ledgerId: string;
  userId: string;
  role: LedgerRole;
  joinedAt: number;
  status: 'active' | 'invited' | 'declined' | 'left';
  nickname?: string;
  notificationPreferences: {
    all?: boolean;
    newTransaction?: boolean;
    updateTransaction?: boolean;
    settlement?: boolean;
    memberJoined?: boolean;
    splitAssigned?: boolean;
    largeExpense?: boolean;
  };
}

export interface LedgerInvitation {
  id: string;
  ledgerId: string;
  createdBy: string;
  targetEmailOrId?: string;
  defaultRole: LedgerRole;
  expiresAt: number;
  status: 'active' | 'used' | 'revoked';
  usageCount: number;
  maxUsage?: number;
  createdAt: number;
}

export type NotificationType = 'split_assigned' | 'large_expense' | 'system' | 'member_joined' | 'fund_empty';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: number;
}

export type ActivityType = 'transaction_created' | 'transaction_updated' | 'transaction_deleted' | 'member_joined' | 'member_left' | 'settlement';

export interface ActivityFeedItem {
  id: string;
  ledgerId: string;
  actorId: string;
  type: ActivityType;
  targetId?: string;
  details: string;
  timestamp: number;
}
