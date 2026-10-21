import React from 'react';
import {
  Printer,
  X,
  MessageCircle,
  Share2,
  CheckCircle,
  AlertTriangle,
  Phone
} from 'lucide-react';
import { ClosingRecord } from '../types';
import { useAuth } from '../context/AuthContext';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  closing: ClosingRecord | null;
}

export function ReceiptModal({ isOpen, onClose, closing }: ReceiptModalProps) {
  const { settings, userProfile } = useAuth();

  if (!isOpen || !closing) return null;

  const phone = settings.whatsappAdminPhone || '085694528073';
  const rawDigits = phone.replace(/\D/g, '');
  const cleanPhone = rawDigits.startsWith('0')
    ? '62' + rawDigits.slice(1)
    : rawDigits.startsWith('62')
      ? rawDigits
      : '62' + rawDigits;

  const cashierDisplayName = userProfile?.displayName
    ? userProfile.displayName
    : (closing.cashierName === 'Siti Rahma' || !closing.cashierName ? 'Emong Kasir' : closing.cashierName);

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text = `*NOTA RESI SETORAN CLOSING SHIFT*\n` +
      `*${settings.businessName || 'EMONG RAMEN HOUSE'}*\n` +
      `System Kasir & Manajemen\n` +
      `WA: ${phone}\n` +
      `--------------------------------\n` +
      `No. Ref: ${closing.id}\n` +
      `Tanggal: ${closing.date}\n` +
      `Kasir: ${cashierDisplayName} (Shift ${closing.shift})\n` +
      `Status: ${closing.status.toUpperCase()}\n` +
      `--------------------------------\n` +
      `Tunai (Cash): ${formatRp(closing.cashAmount)}\n` +
      `Non-Tunai (QRIS): ${formatRp(closing.nonCashAmount)}\n` +
      `TOTAL MASUK: ${formatRp(closing.cashAmount + closing.nonCashAmount)}\n` +
      `Target POS: ${formatRp(closing.expectedPosAmount)}\n` +
      `Selisih: ${closing.discrepancyAmount >= 0 ? '+' : ''}${formatRp(closing.discrepancyAmount)}\n` +
      (closing.discrepancyReason ? `Alasan Selisih: ${closing.discrepancyReason}\n` : '') +
      (closing.notes ? `Catatan: ${closing.notes}\n` : '') +
      `--------------------------------\n` +
      `Dicetak otomatis oleh Sistem Kasir`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 my-auto animate-scale-up">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm tracking-wide">Resi / Nota Pembayaran</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div className="p-5 bg-slate-50 flex justify-center">
          <div
            id="thermal-receipt-print-area"
            className="w-full bg-white p-5 rounded-2xl shadow-xs border border-slate-200 font-mono text-xs text-slate-800 space-y-3"
          >
            {/* Header / Branding */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <p className="text-base font-black tracking-wider text-slate-900 uppercase">
                {settings.businessName || 'EMONG RAMEN HOUSE'}
              </p>
              <p className="text-[10px] text-slate-600 font-sans mt-0.5 font-medium">
                {settings.tagline || 'EMONG RAMEN HOUSE - System Kasir & Manajemen'}
              </p>
              <p className="text-[10px] text-slate-500 font-sans flex items-center justify-center gap-1 mt-1">
                <Phone className="w-2.5 h-2.5 text-emerald-600 inline" />
                WA: {phone}
              </p>
            </div>

            {/* Transaction Meta */}
            <div className="space-y-1 text-[11px] text-slate-600 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span>No. Ref</span>
                <span className="font-bold text-slate-900">{closing.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal</span>
                <span>{closing.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir</span>
                <span className="font-bold text-slate-900">{cashierDisplayName}</span>
              </div>
              <div className="flex justify-between">
                <span>Shift</span>
                <span className="font-semibold">{closing.shift}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span
                  className={`font-bold uppercase ${
                    closing.status === 'approved'
                      ? 'text-emerald-700'
                      : closing.status === 'rejected'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }`}
                >
                  {closing.status}
                </span>
              </div>
            </div>

            {/* Financial Details */}
            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between text-slate-700">
                <span>Uang Tunai (Cash):</span>
                <span className="font-semibold">{formatRp(closing.cashAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Non-Tunai (QRIS/EDC):</span>
                <span className="font-semibold">{formatRp(closing.nonCashAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-100">
                <span>TOTAL SETORAN FISIK:</span>
                <span className="text-emerald-700 text-sm">
                  {formatRp(closing.cashAmount + closing.nonCashAmount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Target Sistem POS:</span>
                <span>{formatRp(closing.expectedPosAmount)}</span>
              </div>

              {/* Discrepancy indicator */}
              <div
                className={`flex justify-between text-[11px] font-bold p-1 rounded-sm ${
                  closing.discrepancyAmount === 0
                    ? 'text-emerald-700 bg-emerald-50'
                    : closing.discrepancyAmount < 0
                    ? 'text-rose-700 bg-rose-50'
                    : 'text-blue-700 bg-blue-50'
                }`}
              >
                <span>Selisih (Diff):</span>
                <span>
                  {closing.discrepancyAmount > 0 ? '+' : ''}
                  {formatRp(closing.discrepancyAmount)}
                </span>
              </div>

              {closing.discrepancyReason && (
                <div className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded-sm">
                  Alasan: "{closing.discrepancyReason}"
                </div>
              )}
            </div>

            {/* Notes */}
            {closing.notes && (
              <div className="text-[10px] text-slate-500 border-b border-dashed border-slate-300 pb-2">
                <span>Catatan: {closing.notes}</span>
              </div>
            )}

            {/* Footer Notice */}
            <div className="text-center pt-1 text-[10px] text-slate-400 font-sans">
              <p className="font-semibold text-slate-600">Terima Kasih atas Kerja Kerasnya!</p>
              <p>EMONG RAMEN HOUSE - Layanan Kasir &amp; POS</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Cetak Resi / Print Nota</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim WA</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
