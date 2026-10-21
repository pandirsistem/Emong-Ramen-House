import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  Clock
} from 'lucide-react';
import { ClosingRecord, ExpenseRecord } from '../types';
import { computePresetRange, DateRangePreset, DateRangeValue } from './DateRangePicker';
import { exportTransactionsToXLSX, exportTransactionsToCSV } from '../lib/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  closings: ClosingRecord[];
  expenses: ExpenseRecord[];
  businessName: string;
  initialDateRange?: DateRangeValue;
  onLogAudit?: (action: string, details: string) => void;
}

export function ExportModal({
  isOpen,
  onClose,
  closings,
  expenses,
  businessName,
  initialDateRange,
  onLogAudit
}: ExportModalProps) {
  // Local state for export filter range
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>(
    initialDateRange?.preset || 'thisMonth'
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dataType, setDataType] = useState<'all' | 'closings' | 'expenses'>('all');
  const [isDownloading, setIsDownloading] = useState(false);

  // Initialize dates based on initial range or default 'thisMonth'
  useEffect(() => {
    if (isOpen) {
      const preset = initialDateRange?.preset || 'thisMonth';
      setSelectedPreset(preset);
      if (initialDateRange?.startDate && initialDateRange?.endDate) {
        setStartDate(initialDateRange.startDate);
        setEndDate(initialDateRange.endDate);
      } else {
        const computed = computePresetRange(preset);
        setStartDate(computed.startDate);
        setEndDate(computed.endDate);
      }
    }
  }, [isOpen, initialDateRange]);

  // Handle Preset Button Click
  const handleSelectPreset = (preset: DateRangePreset) => {
    setSelectedPreset(preset);
    const computed = computePresetRange(preset);
    setStartDate(computed.startDate);
    setEndDate(computed.endDate);
  };

  // Handle Manual Date Change
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setSelectedPreset('custom');
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setSelectedPreset('custom');
  };

  // Filter closings by selected date range
  const filteredClosings = useMemo(() => {
    return closings.filter((c) => {
      if (startDate && c.date < startDate) return false;
      if (endDate && c.date > endDate) return false;
      return true;
    });
  }, [closings, startDate, endDate]);

  // Filter expenses by selected date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });
  }, [expenses, startDate, endDate]);

  // Financial statistics in this chosen range
  const approvedClosings = filteredClosings.filter((c) => c.status === 'approved');
  const pendingClosings = filteredClosings.filter((c) => c.status === 'pending');

  const totalMasukApproved = approvedClosings.reduce(
    (sum, c) => sum + (c.cashAmount || 0) + (c.nonCashAmount || 0),
    0
  );
  const totalPengeluaran = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netCashFlow = totalMasukApproved - totalPengeluaran;

  const dateRangeLabel = useMemo(() => {
    if (startDate && endDate) {
      if (startDate === endDate) return `Tanggal ${startDate}`;
      return `${startDate} s/d ${endDate}`;
    }
    if (startDate) return `Sejak ${startDate}`;
    if (endDate) return `Hingga ${endDate}`;
    return 'Semua Periode';
  }, [startDate, endDate]);

  // Handle Execute Download
  const handleDownload = (format: 'xlsx' | 'csv' = 'xlsx') => {
    setIsDownloading(true);
    try {
      const exportOpts = {
        businessName: businessName || 'EMONG RAMEN HOUSE',
        dateRangeLabel,
        typeFilter: dataType
      };

      if (format === 'xlsx') {
        exportTransactionsToXLSX(filteredClosings, filteredExpenses, exportOpts);
        onLogAudit?.(
          'EXPORT_REPORT_XLSX',
          `Admin mengunduh laporan keuangan Excel (.xlsx) [${dataType.toUpperCase()}] untuk periode ${dateRangeLabel}`
        );
      } else {
        exportTransactionsToCSV(filteredClosings, filteredExpenses, exportOpts);
        onLogAudit?.(
          'EXPORT_REPORT_CSV',
          `Admin mengunduh laporan transaksi CSV [${dataType.toUpperCase()}] untuk periode ${dateRangeLabel}`
        );
      }
      onClose();
    } catch (err) {
      console.error('Failed to export:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight leading-tight">
                Unduh Laporan Keuangan Excel (.xlsx)
              </h3>
              <p className="text-[11px] text-emerald-100">
                Pilih periode tanggal dan cakupan data yang ingin diunduh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* STEP 1: Periode Tanggal Laporan */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-extrabold uppercase tracking-wider text-slate-700 text-[11px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                1. Tentukan Periode Tanggal
              </label>
              <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {dateRangeLabel}
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'last7', label: '7 Hari' },
                { id: 'thisMonth', label: 'Bulan Ini' },
                { id: 'lastMonth', label: 'Bln Lalu' },
                { id: 'all', label: 'Semua' }
              ].map((p) => {
                const active = selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id as DateRangePreset)}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer text-center ${
                      active
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Pickers: Tanggal Mulai s/d Tanggal Selesai */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Pilih Tanggal Mulai &amp; Tanggal Selesai:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Tanggal Mulai (Dari) <span className="text-slate-400 font-normal">YYYY-MM-DD</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Tanggal Selesai (Sampai) <span className="text-slate-400 font-normal">YYYY-MM-DD</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Pilih Cakupan Data */}
          <div className="space-y-2">
            <label className="font-extrabold uppercase tracking-wider text-slate-700 text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              2. Pilih Cakupan Data Laporan
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDataType('all')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  dataType === 'all'
                    ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-xs">📗 Lengkap</span>
                  {dataType === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Semua Sheet: Ringkasan Laba, Kasir &amp; Pengeluaran
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDataType('closings')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  dataType === 'closings'
                    ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-xs">💵 Uang Masuk</span>
                  {dataType === 'closings' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Khusus rekapan shift kasir harian &amp; fisik POS
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDataType('expenses')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  dataType === 'expenses'
                    ? 'border-rose-500 bg-rose-50/80 text-rose-900 ring-2 ring-rose-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-xs">🧾 Pengeluaran</span>
                  {dataType === 'expenses' && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Khusus operasional belanja stok &amp; beban usaha
                </p>
              </button>
            </div>
          </div>

          {/* STEP 3: Pratinjau Keuangan Periode Terpilih */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/90 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
              <span>Pratinjau Data Periode Terpilih:</span>
              <span className="text-[10px] text-slate-500 font-medium">
                {filteredClosings.length} setoran • {filteredExpenses.length} belanja
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Uang Masuk</span>
                <span className="text-xs font-black text-blue-700 block truncate">
                  Rp {totalMasukApproved.toLocaleString('id-ID')}
                </span>
                <span className="text-[9px] text-slate-400 block">{approvedClosings.length} shift</span>
              </div>

              <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Pengeluaran</span>
                <span className="text-xs font-black text-rose-700 block truncate">
                  Rp {totalPengeluaran.toLocaleString('id-ID')}
                </span>
                <span className="text-[9px] text-slate-400 block">{filteredExpenses.length} item</span>
              </div>

              <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Saldo Bersih</span>
                <span
                  className={`text-xs font-black block truncate ${
                    netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  Rp {netCashFlow.toLocaleString('id-ID')}
                </span>
                <span className="text-[9px] text-slate-400 block">
                  {netCashFlow >= 0 ? 'Surplus' : 'Defisit'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Download Action Buttons */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleDownload('csv')}
            disabled={isDownloading}
            className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold underline underline-offset-2 flex items-center justify-center gap-1 cursor-pointer order-2 sm:order-1"
          >
            <span>Unduh format CSV alternatif (.csv)</span>
          </button>

          <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => handleDownload('xlsx')}
              disabled={isDownloading}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Membuat File...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh File Excel (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
