import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  DollarSign,
  AlertTriangle,
  Camera,
  Upload,
  CheckCircle2,
  Send,
  MessageCircle,
  HelpCircle,
  Sparkles,
  Info,
  ShieldAlert,
  FileCheck,
  ChevronRight,
  Printer
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ClosingRecord, ShiftType } from '../types';
import { createWhatsAppNotificationUrl, sendToGoogleSheetsWebhook } from '../lib/googleSheets';
import confetti from 'canvas-confetti';
import { ReceiptModal } from './ReceiptModal';
import { formatCurrency, parseCurrency } from '../lib/formatters';

interface CashierViewProps {
  onOpenVoice: () => void;
  closings: ClosingRecord[];
  onAddClosing: (closing: Omit<ClosingRecord, 'id' | 'createdAt' | 'status'>) => Promise<ClosingRecord>;
}

export function CashierView({ onOpenVoice, closings, onAddClosing }: CashierViewProps) {
  const { userProfile, settings, logAuditAction } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];
  const formattedToday = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Form State
  const [shift, setShift] = useState<ShiftType>('Pagi');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [nonCashAmount, setNonCashAmount] = useState<string>('');
  const [expectedPosAmount, setExpectedPosAmount] = useState<string>('');
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedClosing, setSubmittedClosing] = useState<ClosingRecord | null>(null);
  const [selectedReceiptClosing, setSelectedReceiptClosing] = useState<ClosingRecord | null>(null);
  const [targetWhatsAppPhone, setTargetWhatsAppPhone] = useState<string>(
    settings.whatsappAdminPhone || '085694528073'
  );
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Keep targetWhatsAppPhone updated if settings change and user hasn't customized it
  React.useEffect(() => {
    if (settings.whatsappAdminPhone) {
      setTargetWhatsAppPhone(settings.whatsappAdminPhone);
    }
  }, [settings.whatsappAdminPhone]);

  // Calculations
  const numCash = parseCurrency(cashAmount) || 0;
  const numNonCash = parseCurrency(nonCashAmount) || 0;
  const numPos = parseCurrency(expectedPosAmount) || 0;
  const totalPhysical = numCash + numNonCash;
  const discrepancy = totalPhysical - numPos;
  const hasDiscrepancy = numPos > 0 && discrepancy !== 0;

  // Validation
  const canSubmit =
    numCash >= 0 &&
    numNonCash >= 0 &&
    numPos > 0 &&
    totalPhysical > 0 &&
    (!hasDiscrepancy || discrepancyReason.trim().length >= 5) &&
    !isSubmitting;

  // Filter only TODAY's closings submitted by cashier
  const todayClosings = closings.filter((c) => c.date === todayStr);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const activeCashierName = userProfile?.displayName?.trim() || userProfile?.email?.split('@')[0] || 'Emong Kasir';
      const newRecord = await onAddClosing({
        date: todayStr, // strictly same-day
        cashierId: userProfile?.id || 'cashier-unknown',
        cashierName: activeCashierName,
        shift,
        cashAmount: numCash,
        nonCashAmount: numNonCash,
        expectedPosAmount: numPos,
        discrepancyAmount: discrepancy,
        discrepancyReason: hasDiscrepancy ? discrepancyReason.trim() : '',
        notes: notes.trim(),
        proofPhotoUrl: photoPreview || undefined,
      });

      // Trigger celebrate confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });

      setSubmittedClosing(newRecord);

      // Trigger automatic background webhook to Google Sheets
      if (settings.webhookUrl) {
        sendToGoogleSheetsWebhook(settings.webhookUrl, {
          type: 'closing',
          ...newRecord,
        });
      }

      await logAuditAction(
        'SUBMIT_CLOSING',
        `Kasir ${userProfile?.displayName} mengirim closing shift ${shift}: Tunai Rp ${numCash.toLocaleString('id-ID')}, Non-Tunai Rp ${numNonCash.toLocaleString('id-ID')}, Selisih: Rp ${discrepancy.toLocaleString('id-ID')}`
      );

      // Reset form
      setCashAmount('');
      setNonCashAmount('');
      setExpectedPosAmount('');
      setDiscrepancyReason('');
      setNotes('');
      setPhotoPreview(null);
    } catch (err) {
      console.error('Error submitting closing:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2.5 sm:px-6 py-3.5 sm:py-6 space-y-3 sm:space-y-4">
      {/* Kasir Operational Header Badge */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-xl sm:rounded-2xl text-white p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between gap-2.5 sm:gap-4 relative z-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5 sm:mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-md uppercase tracking-wider">
                Portal Kasir
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Same-Day
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black tracking-tight truncate">
              Closing Shift &amp; Setoran
            </h2>
            <p className="text-[11px] sm:text-xs text-blue-100 flex items-center gap-1.5 truncate">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{formattedToday}</span>
              <span className="opacity-75">• Kasir: <strong>{userProfile?.displayName || 'Kasir'}</strong></span>
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenVoice}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
            title="Isi formulir otomatis menggunakan perintah suara AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
            <span className="hidden xs:inline">Voice AI</span>
          </button>
        </div>

        {/* Strict restriction notice for transparency */}
        <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-blue-100/90 leading-tight">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-300" />
          <span className="truncate">
            Akses Khusus Kasir: Hanya input setoran shift hari ini. Riwayat toko &amp; laba diproteksi Admin.
          </span>
        </div>
      </div>

      {/* Main Closing Shift Form */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
              Input Rekap Uang Kasir (Closing Shift)
            </h3>
            <p className="text-[10.5px] sm:text-xs text-slate-500 hidden sm:block">
              Pastikan hitungan fisik uang tunai di laci dan bukti non-tunai diinput dengan teliti.
            </p>
          </div>
          <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
            Shift Aktif
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          {/* Shift & Date Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Tanggal Operasional
              </label>
              <input
                type="date"
                value={todayStr}
                disabled
                className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Kasir Bertugas
              </label>
              <input
                type="text"
                value={userProfile?.displayName || ''}
                disabled
                className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold cursor-not-allowed truncate"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Shift Kerja
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as ShiftType)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Pagi">Shift Pagi (08:00 - 15:00)</option>
                <option value="Siang">Shift Siang (14:00 - 21:00)</option>
                <option value="Malam">Shift Malam (20:00 - Closing)</option>
                <option value="Full-Day">Full-Day (Seharian Penuh)</option>
              </select>
            </div>
          </div>

          {/* Amounts Section */}
          <div className="p-2.5 sm:p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-2.5 sm:space-y-3">
            <h4 className="text-[11px] sm:text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Rincian Uang Masuk &amp; Validasi POS
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {/* Uang Fisik Tunai */}
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-800 mb-0.5">
                  1. Uang Fisik Tunai (Cash) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(formatCurrency(e.target.value))}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-tight">
                  Uang tunai fisik setelah dikurangi modal kas awal
                </span>
              </div>

              {/* Non Tunai (QRIS / EDC) */}
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-800 mb-0.5">
                  2. Non-Tunai (QRIS / EDC / Transfer) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={nonCashAmount}
                    onChange={(e) => setNonCashAmount(formatCurrency(e.target.value))}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-tight">
                  Total settlement mesin EDC &amp; notifikasi QRIS
                </span>
              </div>

              {/* Target POS Mesin Kasir */}
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-800 mb-0.5">
                  3. Total Omzet POS / Mesin <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={expectedPosAmount}
                    onChange={(e) => setExpectedPosAmount(formatCurrency(e.target.value))}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-tight">
                  Total penjualan pada struk/laporan mesin kasir
                </span>
              </div>
            </div>

            {/* Total Physical vs Target Comparison Bar */}
            <div className="p-2 sm:p-2.5 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Setoran Fisik:
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  Rp {totalPhysical.toLocaleString('id-ID')}
                </span>
              </div>

              {numPos > 0 && (
                <div className="flex items-center gap-1.5">
                  {discrepancy === 0 ? (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fisik Sesuai POS (Rp 0)</span>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        discrepancy > 0
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-rose-50 border-rose-300 text-rose-800'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        {discrepancy > 0 ? 'Kelebihan: +' : 'Selisih: '}
                        Rp {Math.abs(discrepancy).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discrepancy Warning Alert & Mandatory Input */}
            {hasDiscrepancy && (
              <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-300 rounded-lg space-y-1.5 animate-fade-in">
                <div className="flex items-start gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <h5 className="font-bold text-[11px] uppercase tracking-wider">
                      Peringatan Selisih Uang Kasir
                    </h5>
                    <p className="text-[10.5px] text-rose-700 leading-snug">
                      Selisih{' '}
                      <strong>
                        {discrepancy > 0 ? 'Lebih +' : 'Kurang '}Rp {Math.abs(discrepancy).toLocaleString('id-ID')}
                      </strong>{' '}
                      antara fisik vs POS. <strong>Wajib isi alasan</strong> di bawah:
                    </p>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Salah kembalian di struk #12, pembeli lupa uang pas, dll."
                    value={discrepancyReason}
                    onChange={(e) => setDiscrepancyReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                  {discrepancyReason.trim().length < 5 && (
                    <span className="text-[9.5px] text-rose-600 font-semibold mt-0.5 block">
                      Minimal 5 karakter alasan sebelum formulir dapat dikirim.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Catatan Closing & Bukti Foto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Catatan Closing / Serah Terima Shift
              </label>
              <textarea
                rows={2}
                placeholder="Catatan tambahan mengenai kondisi shift, uang kembalian receh..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Bukti Foto Uang / Struk POS</span>
                <span className="text-[9px] text-slate-400 font-normal">Opsional</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="flex-1 flex flex-col items-center justify-center p-2 border border-dashed border-slate-300 hover:border-blue-400 rounded-lg cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition-colors">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold">Ambil Foto / Upload</span>
                  </div>
                  <span className="text-[9px] text-slate-400">JPG/PNG Maks 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {photoPreview && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 shrink-0 shadow-xs">
                    <img
                      src={photoPreview}
                      alt="Preview Foto Bukti"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center text-[9px] hover:bg-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs text-slate-500">
              * Setoran berstatus <strong>Pending</strong> menunggu validasi fisik Admin.
            </span>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengirim Setoran...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Kirim Setoran Shift Hari Ini
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Banner & WhatsApp Trigger */}
      {submittedClosing && (
        <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3 animate-fade-in shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-emerald-900 text-sm">
                  Setoran Shift Berhasil Dicatat!
                </h4>
                <p className="text-xs text-emerald-800">
                  Total setoran <strong>Rp {((submittedClosing.cashAmount || 0) + (submittedClosing.nonCashAmount || 0)).toLocaleString('id-ID')}</strong> telah masuk ke antrean validasi Admin.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSubmittedClosing(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
            >
              Tutup ✕
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-emerald-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedReceiptClosing(submittedClosing)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                Cetak Struk / Resi
              </button>

              <a
                href={createWhatsAppNotificationUrl(
                  targetWhatsAppPhone,
                  submittedClosing,
                  settings.businessName,
                  userProfile?.displayName || 'Emong Kasir'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                Kirim Notifikasi WhatsApp ke Admin
              </a>
            </div>

            {/* Nomor WA Tujuan Display / Edit */}
            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white/80 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
              <span className="text-[11px] font-semibold text-slate-500">Tujuan WA:</span>
              {isEditingPhone ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={targetWhatsAppPhone}
                    onChange={(e) => setTargetWhatsAppPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingPhone(false)}
                    placeholder="08..."
                    autoFocus
                    className="w-28 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 border border-emerald-400 rounded bg-white outline-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(false)}
                    className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="font-mono font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 underline decoration-dotted"
                  title="Klik untuk mengubah nomor WhatsApp tujuan pengiriman"
                >
                  <span>{targetWhatsAppPhone}</span>
                  <span className="text-[10px] text-emerald-600 font-sans font-normal">(Ubah)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Setoran Hari Ini (Restricted to Today's Shift Only) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              Riwayat Setoran Shift Anda Hari Ini ({todayClosings.length})
            </h4>
            <p className="text-xs text-slate-400">
              Hanya menampilkan catatan shift hari ini. Anda tidak dapat melihat hari sebelumnya demi keamanan data.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {formattedToday}
          </span>
        </div>

        {todayClosings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada setoran shift yang dikirim untuk hari ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayClosings.map((c) => {
              const total = (c.cashAmount || 0) + (c.nonCashAmount || 0);
              return (
                <div key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Shift {c.shift}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          c.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : c.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {c.status === 'approved'
                          ? '✓ Disetujui Admin'
                          : c.status === 'rejected'
                          ? '✕ Ditolak'
                          : '⏳ Menunggu Validasi'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Tunai: <strong>Rp {c.cashAmount?.toLocaleString('id-ID')}</strong></span>
                      <span>Non-Tunai: <strong>Rp {c.nonCashAmount?.toLocaleString('id-ID')}</strong></span>
                      <span>Total: <strong className="text-emerald-700">Rp {total.toLocaleString('id-ID')}</strong></span>
                      {c.discrepancyAmount !== 0 && (
                        <span className="text-rose-600 font-semibold">
                          Selisih: {c.discrepancyAmount > 0 ? '+' : ''}Rp {c.discrepancyAmount?.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>

                    {c.discrepancyReason && (
                      <p className="text-xs text-slate-600 italic">
                        Alasan selisih: "{c.discrepancyReason}"
                      </p>
                    )}

                    {c.reviewNotes && (
                      <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded-lg mt-1">
                        Catatan Admin: {c.reviewNotes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedReceiptClosing(c)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Cetak Nota / Resi Kasir"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      Cetak Resi
                    </button>

                    <a
                      href={createWhatsAppNotificationUrl(
                        targetWhatsAppPhone,
                        c,
                        settings.businessName,
                        userProfile?.displayName || 'Emong Kasir'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Kirim WA
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Thermal Receipt Print Modal */}
      <ReceiptModal
        isOpen={!!selectedReceiptClosing}
        onClose={() => setSelectedReceiptClosing(null)}
        closing={selectedReceiptClosing}
      />
    </div>
  );
}
