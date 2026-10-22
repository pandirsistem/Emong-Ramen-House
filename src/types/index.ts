export type UserRole = 'admin' | 'cashier';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  shift?: ShiftType;
  isActive?: boolean;
  status?: 'active' | 'disabled';
  disabledAt?: string;
  deletedAt?: string;
  passwordHint?: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'Beli Bahan Baku'
  | 'Gaji Karyawan Operasional'
  | 'Listrik & Air'
  | 'Sewa Tempat'
  | 'Gas / Bahan Bakar'
  | 'Beli Peralatan & Perlengkapan'
  | 'Saldo Awal / Uang Kembalian'
  | 'Lain-lain (Operasional)';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Beli Bahan Baku',
  'Gaji Karyawan Operasional',
  'Listrik & Air',
  'Sewa Tempat',
  'Gas / Bahan Bakar',
  'Beli Peralatan & Perlengkapan',
  'Saldo Awal / Uang Kembalian',
  'Lain-lain (Operasional)'
];

export type ShiftType = 'Pagi' | 'Siang' | 'Malam' | 'Full-Day';

export type ClosingStatus = 'pending' | 'approved' | 'rejected';

export interface ClosingRecord {
  id: string;
  date: string; // YYYY-MM-DD (must be today for cashier)
  cashierId: string;
  cashierName: string;
  shift: ShiftType;
  cashAmount: number; // Fisik Tunai
  nonCashAmount: number; // QRIS / EDC / Transfer
  expectedPosAmount: number; // Target di mesin kasir / POS
  discrepancyAmount: number; // (cashAmount + nonCashAmount) - expectedPosAmount
  discrepancyReason?: string; // Wajib diisi jika discrepancyAmount != 0
  notes: string;
  proofPhotoUrl?: string; // Bukti foto fisik / closing
  status: ClosingStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  title: string;
  notes?: string;
  receiptPhotoUrl?: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  userEmail: string;
  userName: string;
  role: UserRole;
  details: string;
  timestamp: string;
}

export interface AppSettings {
  spreadsheetUrl: string;
  webhookUrl: string;
  whatsappAdminPhone: string;
  telegramChatId: string;
  telegramBotToken: string;
  businessName: string;
  tagline?: string;
  address?: string;
  initialCapital?: number;
  updatedAt?: string;
}

export interface VoiceParsedData {
  type: 'closing' | 'expense';
  cashAmount?: number;
  nonCashAmount?: number;
  expectedPosAmount?: number;
  shift?: ShiftType;
  expenseCategory?: ExpenseCategory;
  expenseAmount?: number;
  title?: string;
  notes?: string;
  rawTranscript: string;
}
