import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  PieChart,
  BarChart3,
  Calendar,
  Filter,
  Download,
  Printer,
  ShieldAlert,
  PlusCircle,
  Camera,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Settings,
  Layers,
  Sparkles,
  ChevronDown,
  Users,
  UserPlus,
  Trash2,
  Eye,
  EyeOff,
  Key,
  Menu,
  X,
  LogOut,
  UserX,
  UserCheck,
  Shield
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  AuditLogRecord,
  ClosingRecord,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  ExpenseRecord,
  ShiftType,
  UserProfile
} from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, deleteDoc } from 'firebase/firestore';
import { sendToGoogleSheetsWebhook } from '../lib/googleSheets';
import { DateRangePicker, DateRangeValue, computePresetRange } from './DateRangePicker';
import { exportTransactionsToCSV, exportTransactionsToXLSX } from '../lib/exportUtils';
import { ReceiptModal } from './ReceiptModal';
import { formatCurrency, parseCurrency } from '../lib/formatters';
import { ExportModal } from './ExportModal';
import { compressImage } from '../lib/imageCompressor';

interface AdminViewProps {
  onOpenVoice: () => void;
  onOpenGuide: () => void;
  closings: ClosingRecord[];
  expenses: ExpenseRecord[];
  auditLogs: AuditLogRecord[];
  onAddExpense: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => Promise<ExpenseRecord>;
  onReviewClosing: (id: string, status: 'approved' | 'rejected', notes: string) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  activeTab: 'dashboard' | 'approvals' | 'expenses' | 'reports' | 'cashiers' | 'audit' | 'settings';
  setActiveTab: (tab: any) => void;
}

export function AdminView({
  onOpenVoice,
  onOpenGuide,
  closings,
  expenses,
  auditLogs,
  onAddExpense,
  onReviewClosing,
  onDeleteExpense,
  activeTab,
  setActiveTab,
}: AdminViewProps) {
  const {
    userProfile,
    settings,
    updateSettings,
    logAuditAction,
    addCashierAccount,
    deleteCashierAccount,
    toggleCashierStatus,
    logout
  } = useAuth();

  // Cashier management state
  const [cashiers, setCashiers] = useState<UserProfile[]>([]);
  const [cashierName, setCashierName] = useState('');
  const [cashierUsername, setCashierUsername] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [showCashierPassword, setShowCashierPassword] = useState(false);
  const [cashierShift, setCashierShift] = useState<ShiftType>('Pagi');
  const [isSubmittingCashier, setIsSubmittingCashier] = useState(false);
  const [cashierSuccessMsg, setCashierSuccessMsg] = useState<string | null>(null);
  const [cashierErrorMsg, setCashierErrorMsg] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Receipt Modal state
  const [selectedReceiptClosing, setSelectedReceiptClosing] = useState<ClosingRecord | null>(null);

  // Firestore Real-Time Cashier Accounts listener
  useEffect(() => {
    let unsub = () => {};
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'cashier'));
      unsub = onSnapshot(
        q,
        (snap) => {
          const list: UserProfile[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          setCashiers(list);
        },
        (err) => {
          console.warn('Cashier query note:', err.message);
        }
      );
    } catch (e) {
      console.warn('Error setting up cashier listener:', e);
    }
    return () => unsub();
  }, []);

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashierSuccessMsg(null);
    setCashierErrorMsg(null);

    if (!cashierName.trim()) {
      setCashierErrorMsg('Nama kasir wajib diisi.');
      return;
    }
    if (!cashierUsername.trim()) {
      setCashierErrorMsg('Username atau Email kasir wajib diisi.');
      return;
    }
    if (cashierPassword.length < 6) {
      setCashierErrorMsg('Password kasir minimal 6 karakter.');
      return;
    }

    setIsSubmittingCashier(true);
    try {
      await addCashierAccount(
        cashierName.trim(),
        cashierUsername.trim(),
        cashierPassword,
        cashierShift
      );
      setCashierSuccessMsg(`Akun kasir "${cashierName}" berhasil didaftarkan!`);
      setCashierName('');
      setCashierUsername('');
      setCashierPassword('');
      setTimeout(() => setCashierSuccessMsg(null), 4000);
    } catch (err: any) {
      setCashierErrorMsg(err.message || 'Gagal mendaftarkan akun kasir.');
    } finally {
      setIsSubmittingCashier(false);
    }
  };

  const handleToggleStatus = async (id: string, name: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    try {
      await toggleCashierStatus(id, nextActive);
      setCashiers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive: nextActive, status: nextActive ? 'active' : 'disabled' } : c))
      );
      setCashierSuccessMsg(
        nextActive
          ? `Akun kasir "${name}" berhasil diaktifkan kembali.`
          : `Akun kasir "${name}" dinonaktifkan. Sesi aktif langsung dicabut secara real-time!`
      );
      setTimeout(() => setCashierSuccessMsg(null), 4000);
    } catch (err: any) {
      setCashierErrorMsg(err.message || 'Gagal mengubah status kasir.');
      setTimeout(() => setCashierErrorMsg(null), 4000);
    }
  };

  const handleDeleteKasir = async (id: string, name: string) => {
    if (!window.confirm(`Hapus akun kasir "${name}" secara permanen?\nSesi kasir akan langsung dihentikan dan akses login diblokir total.`)) {
      return;
    }

    try {
      await deleteCashierAccount(id, name);
      setCashiers((prev) => prev.filter((c) => c.id !== id));
      setCashierSuccessMsg(`Akun kasir "${name}" berhasil dihapus dan sesi aktifnya langsung dicabut.`);
      setTimeout(() => setCashierSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error deleting cashier:', err);
      setCashierErrorMsg('Gagal menghapus kasir: ' + (err.message || String(err)));
      setTimeout(() => setCashierErrorMsg(null), 4000);
    }
  };

  // Expense form state
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Beli Bahan Baku');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [expenseReceiptPhoto, setExpenseReceiptPhoto] = useState<string | null>(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Approval review modal state
  const [reviewModalClosing, setReviewModalClosing] = useState<ClosingRecord | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Global Date Range Filter (Dashboard, Approvals, Expenses, Reports, Audit Log)
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    preset: 'all',
    startDate: '',
    endDate: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to check if a date falls inside dateRange
  const isDateInRange = (dateStr: string, range: DateRangeValue) => {
    if (range.preset === 'all' || (!range.startDate && !range.endDate)) return true;
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    if (range.startDate && d < range.startDate) return false;
    if (range.endDate && d > range.endDate) return false;
    return true;
  };

  // Settings form state
  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(settings.spreadsheetUrl);
  const [webhookUrlInput, setWebhookUrlInput] = useState(settings.webhookUrl);
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState(settings.whatsappAdminPhone || '085694528073');
  const [businessNameInput, setBusinessNameInput] = useState(settings.businessName || 'EMONG RAMEN HOUSE');
  const [initialCapitalInput, setInitialCapitalInput] = useState<string>((settings.initialCapital || 0).toString());
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState(false);

  const dedupe = <T extends { id: string }>(items: T[]): T[] => {
    const map = new Map<string, T>();
    items.forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  // Filtered collections by Date Range (strictly deduplicated by ID)
  const rangeClosings = useMemo(
    () => dedupe(closings.filter((c) => isDateInRange(c.date, dateRange))),
    [closings, dateRange]
  );
  const rangeExpenses = useMemo(
    () => dedupe(expenses.filter((e) => isDateInRange(e.date, dateRange))),
    [expenses, dateRange]
  );
  const rangeAuditLogs = useMemo(
    () => dedupe(auditLogs.filter((l) => isDateInRange(l.timestamp, dateRange))),
    [auditLogs, dateRange]
  );

  // Financial metrics calculations based on dateRange
  const approvedClosings = useMemo(
    () => rangeClosings.filter((c) => c.status === 'approved'),
    [rangeClosings]
  );
  const pendingClosings = useMemo(
    () => rangeClosings.filter((c) => c.status === 'pending'),
    [rangeClosings]
  );

  const totalIncomeApproved = useMemo(
    () =>
      approvedClosings.reduce(
        (sum, c) => sum + ((c.cashAmount || 0) + (c.nonCashAmount || 0)),
        0
      ),
    [approvedClosings]
  );

  const totalPendingAmount = useMemo(
    () =>
      pendingClosings.reduce(
        (sum, c) => sum + ((c.cashAmount || 0) + (c.nonCashAmount || 0)),
        0
      ),
    [pendingClosings]
  );

  const totalExpense = useMemo(
    () => rangeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [rangeExpenses]
  );

  const totalCashBalance = (settings.initialCapital || 0) + totalIncomeApproved - totalExpense;

  // Expenses breakdown by category based on dateRange
  const expenseByCategory = useMemo(() => {
    const map: Record<ExpenseCategory, number> = {
      'Beli Bahan Baku': 0,
      'Gaji Karyawan Operasional': 0,
      'Listrik & Air': 0,
      'Sewa Tempat': 0,
      'Gas / Bahan Bakar': 0,
      'Beli Peralatan & Perlengkapan': 0,
      'Saldo Awal / Uang Kembalian': 0,
      'Lain-lain (Operasional)': 0,
    };
    rangeExpenses.forEach((e) => {
      if (map[e.category] !== undefined) {
        map[e.category] += e.amount || 0;
      } else {
        map['Lain-lain (Operasional)'] += e.amount || 0;
      }
    });
    return map;
  }, [rangeExpenses]);

  // Handle Photo upload for receipt
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setExpenseReceiptPhoto(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setExpenseReceiptPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Expense Handler
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseCurrency(expenseAmount);
    if (!amountNum || amountNum <= 0 || !expenseTitle.trim()) return;

    setIsSubmittingExpense(true);
    try {
      const expensePayload: any = {
        date: expenseDate,
        category: expenseCategory,
        amount: amountNum,
        title: expenseTitle.trim(),
        notes: expenseNotes.trim(),
        recordedBy: userProfile?.id || 'admin',
        recordedByName: userProfile?.displayName || 'Admin Utama',
      };
      if (expenseReceiptPhoto) {
        expensePayload.receiptPhotoUrl = expenseReceiptPhoto;
      }
      const newExpense = await onAddExpense(expensePayload);

      // Send to Google Sheets Webhook
      if (settings.webhookUrl) {
        sendToGoogleSheetsWebhook(settings.webhookUrl, {
          type: 'expense',
          ...newExpense,
        });
      }

      await logAuditAction(
        'CREATE_EXPENSE',
        `Admin mencatat pengeluaran ${expenseCategory}: Rp ${amountNum.toLocaleString('id-ID')} (${expenseTitle})`
      );

      // Reset form
      setExpenseAmount('');
      setExpenseTitle('');
      setExpenseNotes('');
      setExpenseReceiptPhoto(null);
    } catch (err) {
      console.error('Failed to create expense:', err);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Execute Review Approval
  const handleConfirmReview = async () => {
    if (!reviewModalClosing) return;
    setIsSubmittingReview(true);
    try {
      await onReviewClosing(
        reviewModalClosing.id,
        reviewStatus,
        reviewNotes.trim() || (reviewStatus === 'approved' ? 'Uang fisik tunai telah diterima dan diverifikasi sesuai.' : 'Ditolak, data tidak sesuai fisik.')
      );

      await logAuditAction(
        reviewStatus === 'approved' ? 'APPROVE_CLOSING' : 'REJECT_CLOSING',
        `Admin memproses setoran kasir ${reviewModalClosing.cashierName} (Shift ${reviewModalClosing.shift}) menjadi ${reviewStatus.toUpperCase()}`
      );

      setReviewModalClosing(null);
      setReviewNotes('');
    } catch (err) {
      console.error('Review failed:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateSettings({
        spreadsheetUrl: spreadsheetUrlInput,
        webhookUrl: webhookUrlInput,
        whatsappAdminPhone: whatsappPhoneInput,
        businessName: businessNameInput,
        initialCapital: parseCurrency(initialCapitalInput),
      });
      setSettingsSuccessMsg(true);
      setTimeout(() => setSettingsSuccessMsg(false), 3000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filtered transactions for reports (combining Date Range with Search Query)
  const filteredClosings = useMemo(() => {
    return rangeClosings.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.cashierName.toLowerCase().includes(q) ||
          c.shift.toLowerCase().includes(q) ||
          (c.notes && c.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [rangeClosings, searchQuery]);

  const filteredExpenses = useMemo(() => {
    return rangeExpenses.filter((e) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [rangeExpenses, searchQuery]);

  const filteredAuditLogs = useMemo(() => {
    return rangeAuditLogs.filter((log) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          log.userName.toLowerCase().includes(q) ||
          log.userEmail.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rangeAuditLogs, searchQuery]);

  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, { month: string; income: number; expense: number }>();
    
    rangeClosings.forEach((c) => {
      const month = c.date.substring(0, 7);
      const existing = dataMap.get(month) || { month, income: 0, expense: 0 };
      existing.income += (c.cashAmount || 0) + (c.nonCashAmount || 0);
      dataMap.set(month, existing);
    });
    
    rangeExpenses.forEach((e) => {
      const month = e.date.substring(0, 7);
      const existing = dataMap.get(month) || { month, income: 0, expense: 0 };
      existing.expense += (e.amount || 0);
      dataMap.set(month, existing);
    });
    
    return Array.from(dataMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [rangeClosings, rangeExpenses]);

  // Export State & Handlers (CSV / Excel format)
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const getDateRangeLabel = () => {
    if (dateRange.preset === 'all') return 'Semua Periode';
    if (dateRange.startDate && dateRange.endDate) {
      return `${dateRange.startDate} s/d ${dateRange.endDate}`;
    }
    return dateRange.preset;
  };

  const handleTriggerExport = (
    typeFilter: 'all' | 'closings' | 'expenses' = 'all',
    format: 'xlsx' | 'csv' = 'xlsx'
  ) => {
    const rangeLabel = getDateRangeLabel();
    const exportOpts = {
      businessName: settings.businessName || 'EMONG RAMEN HOUSE',
      dateRangeLabel: rangeLabel,
      typeFilter,
    };

    if (format === 'xlsx') {
      exportTransactionsToXLSX(filteredClosings, filteredExpenses, exportOpts);
      logAuditAction(
        'EXPORT_REPORT',
        `Admin mengunduh laporan keuangan Excel (.xlsx) [${typeFilter.toUpperCase()}] untuk periode: ${rangeLabel}`
      );
    } else {
      exportTransactionsToCSV(filteredClosings, filteredExpenses, exportOpts);
      logAuditAction(
        'EXPORT_REPORT',
        `Admin mengunduh laporan transaksi CSV [${typeFilter.toUpperCase()}] untuk periode: ${rangeLabel}`
      );
    }
    setShowExportMenu(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-3 sm:space-y-6">
      {/* Global Filter Bar for Admin */}
      <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-1.5 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="hidden md:flex text-xs font-bold text-slate-700 uppercase tracking-wider items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              Periode Data:
            </span>
            <DateRangePicker
              value={dateRange}
              onChange={(newRange) => setDateRange(newRange)}
            />
          </div>

          {dateRange.preset !== 'all' && (
            <button
              type="button"
              onClick={() => setDateRange({ preset: 'all', startDate: '', endDate: '' })}
              className="text-[10px] sm:text-xs text-purple-700 hover:text-purple-900 font-semibold bg-purple-50 hover:bg-purple-100 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg border border-purple-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Reset Filter Tanggal"
            >
              ✕ <span className="hidden xs:inline">Reset</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
              📊 {rangeClosings.length} Setoran
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
              🛒 {rangeExpenses.length} Belanja
            </span>
          </div>

          {/* Download Excel (.xlsx) button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] sm:text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            title="Tentukan periode tanggal dan unduh file Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Unduh Excel</span>
            <span className="xs:hidden">Excel</span>
            <Calendar className="w-3 h-3 opacity-85 ml-0.5" />
          </button>
        </div>
      </div>

      {/* 1. DASHBOARD & GRAFIK */}
      {activeTab === 'dashboard' && (<>
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* Saldo Bersih */}
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] sm:min-h-[84px]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 truncate">
                  Saldo Bersih
                </span>
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 ${totalCashBalance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-1">
                <h3 className="text-xs sm:text-base md:text-lg font-black text-slate-900 truncate tracking-tight">
                  Rp {totalCashBalance.toLocaleString('id-ID')}
                </h3>
              </div>
            </div>

            {/* Total Pemasukan Approved */}
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] sm:min-h-[84px]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 truncate">
                  Total Masuk
                </span>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-1">
                <h3 className="text-xs sm:text-base md:text-lg font-black text-blue-900 truncate tracking-tight">
                  Rp {totalIncomeApproved.toLocaleString('id-ID')}
                </h3>
              </div>
            </div>

            {/* Total Pengeluaran */}
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] sm:min-h-[84px]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 truncate">
                  Pengeluaran
                </span>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-1">
                <h3 className="text-xs sm:text-base md:text-lg font-black text-rose-900 truncate tracking-tight">
                  Rp {totalExpense.toLocaleString('id-ID')}
                </h3>
              </div>
            </div>

            {/* Setoran Kasir Pending */}
            <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50/25 shadow-xs flex flex-col justify-between min-h-[72px] sm:min-h-[84px]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 truncate">
                  Pending
                </span>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-1">
                <h3 className="text-xs sm:text-base md:text-lg font-black text-amber-900 truncate tracking-tight">
                  Rp {totalPendingAmount.toLocaleString('id-ID')}
                </h3>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Bar Chart: Perbandingan Arus Kas */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    Perbandingan Pemasukan vs Pengeluaran
                  </h4>
                  <p className="text-xs text-slate-400">
                    Proporsi uang masuk tervalidasi vs beban belanja bisnis
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
                  Rekapitulasi
                </span>
              </div>

              {/* Dynamic Visual Ratio Bar */}
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-blue-700">Pemasukan Approved</span>
                    <span className="text-blue-900">Rp {totalIncomeApproved.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-700"
                      style={{
                        width: `${
                          totalIncomeApproved + totalExpense > 0
                            ? (totalIncomeApproved / (totalIncomeApproved + totalExpense)) * 100
                            : 50
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-rose-700">Pengeluaran Operasional</span>
                    <span className="text-rose-900">Rp {totalExpense.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-700"
                      style={{
                        width: `${
                          totalIncomeApproved + totalExpense > 0
                            ? (totalExpense / (totalIncomeApproved + totalExpense)) * 100
                            : 50
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Margin Laba Operasional:</span>
                  <span
                    className={`font-black text-sm ${
                      totalCashBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {totalIncomeApproved > 0
                      ? `${((totalCashBalance / totalIncomeApproved) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Breakdown by 7 Categories */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-600" />
                    Porsi 7 Kategori Pengeluaran
                  </h4>
                  <p className="text-[11px] text-slate-400">Distribusi alokasi dana bisnis</p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const amt = expenseByCategory[cat] || 0;
                  const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-700 truncate max-w-[160px]">
                          {cat}
                        </span>
                        <span className="font-bold text-slate-900">
                          Rp {amt.toLocaleString('id-ID')}{' '}
                          <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            Tren Keuangan Bulanan
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => [`Rp ${(Number(value) || 0).toLocaleString('id-ID')}`, '']} />
                <Legend />
                <Bar dataKey="income" name="Pemasukan" fill="#10b981" />
                <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
      )}

      {/* 2. APPROVAL SYSTEM */}
      {activeTab === 'approvals' && (
        <div className="space-y-5 animate-fade-in">
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-purple-900 text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                Persetujuan Setoran Kasir (Approval System)
              </h3>
              <p className="text-xs text-purple-700 mt-0.5">
                Pastikan uang fisik tunai telah diterima dan dicocokkan dengan catatan sistem kasir.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
              <span className="px-3 py-1 bg-white rounded-xl shadow-xs border border-purple-200">
                {pendingClosings.length} Menunggu Tindakan
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            {rangeClosings.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Belum ada data setoran kasir pada periode tanggal yang dipilih.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rangeClosings.map((c, idx) => {
                  const total = (c.cashAmount || 0) + (c.nonCashAmount || 0);
                  const isPending = c.status === 'pending';

                  return (
                    <div
                      key={c.id || `cls-${idx}`}
                      className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        isPending ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {c.cashierName}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700">
                            Shift {c.shift}
                          </span>
                          <span className="text-xs text-slate-400">📅 {c.date}</span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              c.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}
                          >
                            {c.status === 'approved'
                              ? '✓ Approved'
                              : c.status === 'rejected'
                              ? '✕ Rejected'
                              : '⏳ Pending'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600 pt-1">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fisik Tunai:</span>
                            <span className="font-bold text-slate-800">
                              Rp {c.cashAmount?.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Non-Tunai (QRIS):</span>
                            <span className="font-bold text-slate-800">
                              Rp {c.nonCashAmount?.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Total Setoran:</span>
                            <span className="font-extrabold text-emerald-700">
                              Rp {total.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Selisih vs POS:</span>
                            <span
                              className={`font-bold ${
                                c.discrepancyAmount === 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {c.discrepancyAmount === 0
                                ? 'Sesuai (Rp 0)'
                                : `${c.discrepancyAmount > 0 ? '+' : ''}Rp ${c.discrepancyAmount?.toLocaleString('id-ID')}`}
                            </span>
                          </div>
                        </div>

                        {c.discrepancyReason && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                            <strong>Alasan Selisih Kasir:</strong> {c.discrepancyReason}
                          </div>
                        )}

                        {c.notes && (
                          <p className="text-xs text-slate-500 italic">Catatan: "{c.notes}"</p>
                        )}

                        {c.reviewNotes && (
                          <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                            <strong>Hasil Review Admin ({c.reviewedByName || 'Admin'}):</strong>{' '}
                            {c.reviewNotes}
                          </div>
                        )}
                      </div>

                      {/* Photo preview & Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {c.proofPhotoUrl && (
                          <a
                            href={c.proofPhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-1 font-semibold"
                          >
                            <Camera className="w-3.5 h-3.5 text-blue-600" />
                            Foto Bukti
                          </a>
                        )}

                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalClosing(c);
                              setReviewStatus('approved');
                              setReviewNotes('');
                            }}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow transition-all active:scale-95 cursor-pointer"
                          >
                            Validasi &amp; Tinjau Setoran
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalClosing(c);
                              setReviewStatus(c.status === 'rejected' ? 'rejected' : 'approved');
                              setReviewNotes(c.reviewNotes || '');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            Ubah Status
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. INPUT PENGELUARAN OPERASIONAL */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Form Create Expense */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Catat Pengeluaran Operasional
                </h3>
                <p className="text-xs text-slate-500">Khusus Akun Admin (Full Access)</p>
              </div>
              <button
                type="button"
                onClick={onOpenVoice}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Voice AI
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tanggal Pengeluaran
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Kategori Spesifik (7 Kategori SOP)
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Pengeluaran / Item <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Daging ayam &amp; telur 10kg"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nominal Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(formatCurrency(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Catatan Keterangan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan toko pembelian, nomor nota, dll..."
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Upload Foto Struk / Nota
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-xl cursor-pointer bg-slate-50 text-xs font-semibold text-slate-600 transition-colors">
                    <Camera className="w-4 h-4 text-purple-600" />
                    <span>Unggah Struk</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                  </label>
                  {expenseReceiptPhoto && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                      <img
                        src={expenseReceiptPhoto}
                        alt="Preview Struk"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setExpenseReceiptPhoto(null)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[8px]"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingExpense || !expenseAmount || !expenseTitle}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmittingExpense ? 'Menyimpan...' : 'Simpan Pengeluaran Operasional'}
              </button>
            </form>
          </div>

          {/* List Expenses */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Daftar Riwayat Pengeluaran ({filteredExpenses.length})
                </h4>
                <p className="text-xs text-slate-400">Total belanja bisnis pada periode ini</p>
              </div>
              <span className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                Total: Rp {totalExpense.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[600px]">
              {filteredExpenses.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada catatan pengeluaran operasional pada periode yang dipilih.
                </div>
              ) : (
                filteredExpenses.map((e, idx) => (
                  <div
                    key={e.id ? `${e.id}-${idx}` : `exp-${idx}`}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{e.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {e.category}
                        </span>
                        <span className="text-xs text-slate-400">📅 {e.date}</span>
                      </div>
                      {e.notes && <p className="text-xs text-slate-500 italic">"{e.notes}"</p>}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-black text-rose-600 text-sm block">
                          - Rp {e.amount.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Oleh: {e.recordedByName}
                        </span>
                      </div>
                      {e.receiptPhotoUrl && (
                        <a
                          href={e.receiptPhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Lihat Foto Struk"
                        >
                          <Camera className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => onDeleteExpense(e.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        title="Hapus Transaksi"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. MANAJEMEN KASIR TAB (2-PANEL LAYOUT) */}
      {activeTab === 'cashiers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Manajemen Akun Kasir</h3>
              <p className="text-xs text-slate-500">
                Daftarkan akun kasir baru dan kelola hak akses staf kasir
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-50 text-purple-800 rounded-xl text-xs font-bold border border-purple-200">
              {cashiers.length} Kasir Terdaftar
            </span>
          </div>

          {cashierSuccessMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{cashierSuccessMsg}</span>
            </div>
          )}
          {cashierErrorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{cashierErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Panel Kiri: Form Tambah Kasir Baru */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" />
                Tambah Kasir Baru
              </h4>
              <form onSubmit={handleCreateCashier} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Kasir
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Lengkap Kasir"
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Email / Username
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: kasir1 atau kasir1@emongramen.com"
                    value={cashierUsername}
                    onChange={(e) => setCashierUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Password Kasir
                  </label>
                  <div className="relative">
                    <input
                      type={showCashierPassword ? 'text' : 'password'}
                      placeholder="Minimal 6 karakter"
                      value={cashierPassword}
                      onChange={(e) => setCashierPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCashierPassword(!showCashierPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showCashierPassword ? 'Sembunyikan' : 'Lihat'}
                    >
                      {showCashierPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Pilihan Shift Kerja
                  </label>
                  <select
                    value={cashierShift}
                    onChange={(e) => setCashierShift(e.target.value as ShiftType)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="Pagi">Shift Pagi</option>
                    <option value="Siang">Shift Siang</option>
                    <option value="Malam">Shift Malam</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingCashier}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCashier ? 'Mendaftarkan ke Firebase...' : 'Tambah Kasir'}
                </button>
              </form>
            </div>

            {/* Panel Kanan: Tabel / Daftar Kasir */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col">
              <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  Daftar Kasir Terdaftar
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  ({cashiers.length} akun)
                </span>
              </h4>

              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[380px]">
                {cashiers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Belum ada kasir yang terdaftar di Firestore.
                  </div>
                ) : (
                    cashiers.map((c) => {
                      const isAccountActive = c.isActive !== false && c.status !== 'disabled';
                      return (
                        <div
                          key={c.id}
                          className={`py-3 px-2.5 flex items-center justify-between rounded-xl transition-colors border mb-1.5 last:mb-0 ${
                            isAccountActive
                              ? 'bg-white hover:bg-slate-50/90 border-slate-100'
                              : 'bg-rose-50/40 hover:bg-rose-50/70 border-rose-100'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1 pr-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-bold text-xs text-slate-900 truncate">{c.displayName}</p>
                              <span className="inline-block text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                                Shift {c.shift || 'Pagi'}
                              </span>
                              {isAccountActive ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <UserCheck className="w-2.5 h-2.5" /> Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                                  <UserX className="w-2.5 h-2.5" /> Dinonaktifkan
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate">{c.email}</p>
                            
                            {/* Admin Password View with Show/Hide Toggle */}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                                <Key className="w-3 h-3 text-amber-500" />
                                Password:
                              </span>
                              <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {visiblePasswords[c.id] ? (c.passwordHint || 'Tersimpan (Enkripsi)') : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVisiblePasswords((prev) => ({ ...prev, [c.id]: !prev[c.id] }));
                                }}
                                className="text-slate-400 hover:text-purple-600 transition-colors p-0.5 rounded cursor-pointer"
                                title={visiblePasswords[c.id] ? 'Sembunyikan Password' : 'Lihat Password'}
                                aria-label="Toggle password view"
                              >
                                {visiblePasswords[c.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                          </div>

                          {/* Tombol Aksi Status & Hapus */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Tombol Soft-Delete / Toggle Status */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(c.id, c.displayName || c.email, isAccountActive);
                              }}
                              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                                isAccountActive
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title={isAccountActive ? 'Nonaktifkan Akun (Cabut sesi login kasir langsung)' : 'Aktifkan Kembali'}
                            >
                              {isAccountActive ? (
                                <>
                                  <UserX className="w-3 h-3 text-amber-600" />
                                  <span className="hidden sm:inline">Nonaktifkan</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3 text-emerald-600" />
                                  <span className="hidden sm:inline">Aktifkan</span>
                                </>
                              )}
                            </button>

                            {/* Tombol Hapus Permanen */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteKasir(c.id, c.displayName || c.email);
                              }}
                              className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                              title="Hapus Kasir Permanen"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Security Best Practice Notice Box */}
                <div className="mt-3 p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-[11px] text-purple-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-purple-900">
                    <Shield className="w-3.5 h-3.5 text-purple-700" />
                    <span>Keamanan Akun &amp; Pembatalan Sesi (Real-Time Auth Guard)</span>
                  </div>
                  <p className="text-purple-800/90 leading-relaxed">
                    • <strong>Nonaktifkan (Soft Delete)</strong>: Mempertahankan data transaksi lama pada laporan keuangan, namun langsung memutuskan sesi login kasir yang sedang aktif secara <em>real-time</em> dan memblokir login kembali.
                  </p>
                  <p className="text-purple-800/90 leading-relaxed">
                    • <strong>Hapus Permanen</strong>: Menghapus profil dari database dan mencabut token otentikasi kasir.
                  </p>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* 5. LAPORAN PERIODIK (Harian, Mingguan, Bulanan, Tahunan) */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 animate-fade-in">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Laporan Keuangan Periodik
              </h3>
              <p className="text-xs text-slate-500">
                Rekapitulasi lengkap pemasukan kasir dan pengeluaran operasional dengan opsi ekspor
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleTriggerExport('all')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow transition-all active:scale-95 cursor-pointer"
                title="Unduh laporan ke Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </button>
            </div>
          </div>

            {/* Period Filter Buttons & DateRangePicker */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              <DateRangePicker
                value={dateRange}
                onChange={(newRange) => setDateRange(newRange)}
              />
              <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200 overflow-x-auto">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'last7', label: '7 Hari' },
                  { id: 'thisMonth', label: 'Bln Ini' },
                ].map((item) => {
                  const isSelected = dateRange.preset === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const preset = item.id as DateRangeValue['preset'];
                        const { startDate, endDate } = computePresetRange(preset);
                        setDateRange({ preset, startDate, endDate });
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-56"
              />
            </div>
          </div>

          {/* Metrics summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Total Masuk Periode Ini:</span>
              <span className="font-extrabold text-sm text-blue-700">
                Rp {totalIncomeApproved.toLocaleString('id-ID')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Belanja Periode Ini:</span>
              <span className="font-extrabold text-sm text-rose-600">
                Rp {totalExpense.toLocaleString('id-ID')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Saldo Bersih Periode Ini:</span>
              <span className="font-black text-sm text-slate-900">
                Rp {totalCashBalance.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Data Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Tipe</th>
                  <th className="p-3">Kategori / Shift</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-right">Masuk (Rp)</th>
                  <th className="p-3 text-right">Keluar (Rp)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClosings.map((c, idx) => {
                  const income = (c.cashAmount || 0) + (c.nonCashAmount || 0);
                  return (
                    <tr key={`cls-rep-${idx}`} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium whitespace-nowrap">{c.date}</td>
                      <td className="p-3 font-semibold text-blue-700">Setoran Closing</td>
                      <td className="p-3">Shift {c.shift}</td>
                      <td className="p-3">
                        Kasir: <strong>{c.cashierName}</strong>
                        {c.notes && <span className="text-slate-400 block">"{c.notes}"</span>}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700">
                        {c.status === 'approved' ? `+ Rp ${income.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-400">-</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredExpenses.map((e, idx) => (
                  <tr key={`exp-rep-${idx}`} className="hover:bg-slate-50/50">
                    <td className="p-3 font-medium whitespace-nowrap">{e.date}</td>
                    <td className="p-3 font-semibold text-rose-600">Pengeluaran</td>
                    <td className="p-3">{e.category}</td>
                    <td className="p-3">
                      <strong>{e.title}</strong>
                      {e.notes && <span className="text-slate-400 block">"{e.notes}"</span>}
                    </td>
                    <td className="p-3 text-right font-medium text-slate-400">-</td>
                    <td className="p-3 text-right font-bold text-rose-600">
                      - Rp {e.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        Selesai
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                Catatan Aktivitas Sistem (Audit Log - {filteredAuditLogs.length})
              </h3>
              <p className="text-xs text-slate-500">
                Rekaman histori validasi setoran, input belanja, pendaftaran kasir, dan perubahan setting
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari audit log..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-56"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada data audit log pada periode yang dipilih.
              </div>
            ) : (
              filteredAuditLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{log.userName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {log.role}
                      </span>
                      <span className="text-slate-400">• {log.userEmail}</span>
                    </div>
                    <p className="text-slate-700 font-medium">{log.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600">{log.action}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 7. PENGATURAN & WEBHOOK INTEGRASI */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  Pengaturan Integrasi &amp; Webhook
                </h3>
                <p className="text-xs text-slate-500">
                  Konfigurasikan alamat Google Sheets, URL Webhook Apps Script, dan nomor WhatsApp
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenGuide}
                className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200 hover:bg-blue-100 cursor-pointer"
              >
                Lihat Panduan Pemasangan
              </button>
            </div>

            {settingsSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Pengaturan berhasil disimpan!
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Bisnis / Toko
                </label>
                <input
                  type="text"
                  value={businessNameInput}
                  onChange={(e) => setBusinessNameInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  URL Dokumen Google Spreadsheet Utama
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/your-id/edit"
                  value={spreadsheetUrlInput}
                  onChange={(e) => setSpreadsheetUrlInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Link ini akan terbuka otomatis saat tombol 'Google Sheets' di header Admin diklik. (Cukup diset sekali)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  URL Google Apps Script Webhook (Pencatatan Otomatis)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Setiap transaksi baru otomatis diposting ke endpoint Apps Script ini. (Cukup diset sekali)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nomor WhatsApp Admin / Owner
                </label>
                <input
                  type="text"
                  placeholder="6281234567890"
                  value={whatsappPhoneInput}
                  onChange={(e) => setWhatsappPhoneInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Uang Modal
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={initialCapitalInput}
                    onChange={(e) => setInitialCapitalInput(formatCurrency(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(parseCurrency(initialCapitalInput))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow cursor-pointer disabled:opacity-50"
              >
                {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </form>
          </div>

          {/* Status Box */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
            <h4 className="font-bold text-slate-800 text-sm">Status Integrasi Sistem</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">Firebase Firestore:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  ✓ Terhubung
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">Google Sheets Webhook:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    settings.webhookUrl
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-amber-700 bg-amber-50'
                  }`}
                >
                  {settings.webhookUrl ? '✓ Terpasang' : 'Belum Diisi'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">WhatsApp Notifikasi:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  ✓ Siap
                </span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={settings.spreadsheetUrl || 'https://docs.google.com/spreadsheets'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold flex items-center justify-center gap-2 text-xs"
              >
                <span>Uji Buka Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Review Approval Modal */}
      {reviewModalClosing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-800 text-sm">
                Validasi Fisik Setoran Kasir
              </h4>
              <button
                onClick={() => setReviewModalClosing(null)}
                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Kasir / Shift:</span>
                <span className="font-bold text-slate-800">
                  {reviewModalClosing.cashierName} (Shift {reviewModalClosing.shift})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fisik Tunai (Cash):</span>
                <span className="font-bold text-emerald-700">
                  Rp {reviewModalClosing.cashAmount?.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Non-Tunai:</span>
                <span className="font-bold text-blue-700">
                  Rp {reviewModalClosing.nonCashAmount?.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-500 font-semibold">Total Masuk:</span>
                <span className="font-black text-slate-900">
                  Rp{' '}
                  {(
                    (reviewModalClosing.cashAmount || 0) + (reviewModalClosing.nonCashAmount || 0)
                  ).toLocaleString('id-ID')}
                </span>
              </div>
              {reviewModalClosing.discrepancyAmount !== 0 && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px] mt-1">
                  <strong>Selisih:</strong> Rp{' '}
                  {reviewModalClosing.discrepancyAmount?.toLocaleString('id-ID')}
                  <br />
                  <strong>Alasan:</strong> {reviewModalClosing.discrepancyReason || '-'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Keputusan:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewStatus('approved')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    reviewStatus === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                  }`}
                >
                  ✓ Setujui (Approved)
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatus('rejected')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    reviewStatus === 'rejected'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50'
                  }`}
                >
                  ✕ Tolak (Rejected)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Validasi Admin:
              </label>
              <textarea
                rows={2}
                placeholder="Catatan validasi brankas, nomor amplop, atau alasan penolakan..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReviewModalClosing(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={isSubmittingReview}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReview ? 'Menyimpan...' : 'Simpan Keputusan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedReceiptClosing)}
        closing={selectedReceiptClosing}
        onClose={() => setSelectedReceiptClosing(null)}
      />

      {/* Export Modal with Date Range Selector & Preview */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        closings={closings}
        expenses={expenses}
        businessName={settings.businessName || 'EMONG RAMEN HOUSE'}
        initialDateRange={dateRange}
        onLogAudit={(action, details) => logAuditAction(action, details)}
      />
    </div>
  );
}
