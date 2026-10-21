import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Check, AlertCircle, Volume2, RefreshCw, X, ArrowRight } from 'lucide-react';
import { EXPENSE_CATEGORIES, ExpenseCategory, ShiftType, VoiceParsedData } from '../types';
import { parseVoiceTranscript } from '../lib/voiceParser';
import { formatRupiahSpoken, speakText } from '../lib/tts';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'admin' | 'cashier';
  onConfirmClosing: (data: {
    cashAmount: number;
    nonCashAmount: number;
    expectedPosAmount: number;
    shift: ShiftType;
    notes: string;
  }) => void;
  onConfirmExpense: (data: {
    category: ExpenseCategory;
    amount: number;
    title: string;
    notes: string;
  }) => void;
}

export function VoiceModal({
  isOpen,
  onClose,
  role,
  onConfirmClosing,
  onConfirmExpense,
}: VoiceModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<VoiceParsedData | null>(null);

  // Editable fields in preview
  const [editCash, setEditCash] = useState<number>(0);
  const [editNonCash, setEditNonCash] = useState<number>(0);
  const [editShift, setEditShift] = useState<ShiftType>('Pagi');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('Beli Bahan Baku');
  const [editExpenseAmount, setEditExpenseAmount] = useState<number>(0);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript('');
      setParsedResult(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const startListening = () => {
    setErrorMsg(null);
    setTranscript('');
    setParsedResult(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg(
        'Browser Anda belum mendukung Web Speech API bawaan. Anda dapat mengetikkan atau mencoba di Google Chrome / Microsoft Edge / Safari terbaru.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Izin mikrofon ditolak. Mohon aktifkan izin mikrofon pada browser Anda.');
        } else if (event.error === 'no-speech') {
          setErrorMsg('Tidak ada suara terdeteksi. Silakan coba lagi dan berbicara lebih dekat ke mikrofon.');
        } else {
          setErrorMsg(`Error input suara: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setErrorMsg('Gagal memulai perekam suara.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleProcessTranscript = async (textToProcess?: string) => {
    const text = textToProcess || transcript;
    if (!text.trim()) {
      setErrorMsg('Silakan ucapkan atau pilih contoh kalimat transaksi terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await parseVoiceTranscript(text, role);
      setParsedResult(res);

      if (res.type === 'closing') {
        setEditCash(res.cashAmount || 0);
        setEditNonCash(res.nonCashAmount || 0);
        setEditShift(res.shift || 'Pagi');
        setEditNotes(res.notes || `Input Suara: "${text}"`);
      } else {
        setEditCategory(res.expenseCategory || 'Beli Bahan Baku');
        setEditExpenseAmount(res.expenseAmount || 0);
        setEditTitle(res.title || 'Pengeluaran Operasional');
        setEditNotes(res.notes || `Input Suara: "${text}"`);
      }
    } catch (e) {
      setErrorMsg('Gagal memproses ucapan. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyExample = (exampleText: string) => {
    setTranscript(exampleText);
    handleProcessTranscript(exampleText);
  };

  const handleFinalSave = async () => {
    if (!parsedResult) return;

    if (parsedResult.type === 'closing') {
      const total = editCash + editNonCash;
      onConfirmClosing({
        cashAmount: editCash,
        nonCashAmount: editNonCash,
        expectedPosAmount: total,
        shift: editShift,
        notes: editNotes,
      });

      // Spoken voice feedback
      await speakText(`Setoran closing shift ${editShift} sebesar ${formatRupiahSpoken(total)} berhasil dicatat.`);
    } else {
      onConfirmExpense({
        category: editCategory,
        amount: editExpenseAmount,
        title: editTitle,
        notes: editNotes,
      });

      // Spoken voice feedback
      await speakText(`Pengeluaran ${editCategory} sebesar ${formatRupiahSpoken(editExpenseAmount)} berhasil disimpan.`);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                Voice AI Input &amp; Parsing
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {role === 'admin' ? 'Mode Admin' : 'Mode Kasir'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Ucapkan transaksi dalam Bahasa Indonesia alami, AI akan memprosesnya otomatis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Mic Interaction Area */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <div className="relative">
              {isListening && (
                <>
                  <div className="absolute -inset-4 rounded-full bg-emerald-400/30 animate-ping" />
                  <div className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
                </>
              )}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 ${
                  isListening
                    ? 'bg-rose-500 hover:bg-rose-600 ring-4 ring-rose-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-100'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-9 h-9 animate-bounce" />
                ) : (
                  <Mic className="w-9 h-9" />
                )}
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="font-semibold text-slate-800">
                {isListening ? 'Mendengarkan ucapan Anda...' : 'Klik mikrofon untuk mulai bicara'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isListening
                  ? 'Bicaralah dengan jelas dalam Bahasa Indonesia...'
                  : 'Atau pilih contoh simulasi ucapan di bawah'}
              </p>
            </div>

            {/* Transcript Display */}
            {transcript && (
              <div className="mt-4 w-full p-3.5 bg-white rounded-xl border border-slate-200 shadow-inner">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Transkrip Suara:
                </span>
                <p className="text-sm font-medium text-slate-700 italic">
                  "{transcript}"
                </p>
              </div>
            )}

            {/* Action button if transcript exists but not processed */}
            {transcript && !parsedResult && !isListening && (
              <button
                onClick={() => handleProcessTranscript()}
                disabled={isProcessing}
                className="mt-3.5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition-all active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memproses AI NLP...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Proses Transkrip Suara
                  </>
                )}
              </button>
            )}
          </div>

          {/* Quick Audio Examples for user testing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                💡 Contoh Cepat Simulasi Suara:
              </span>
              <span className="text-[11px] text-slate-400">Klik untuk mencoba</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {role === 'cashier' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleApplyExample('Setoran tunai 2 juta non tunai 500 ribu shift pagi')}
                    className="text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                  >
                    <span className="font-semibold text-emerald-800 block">Closing Shift Pagi:</span>
                    "Setoran tunai 2 juta non tunai 500 ribu shift pagi"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyExample('Closing shift siang tunai 1 juta 800 ribu non tunai 450 ribu')}
                    className="text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                  >
                    <span className="font-semibold text-emerald-800 block">Closing Shift Siang:</span>
                    "Closing shift siang tunai 1 juta 800 ribu non tunai 450 ribu"
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleApplyExample('Beli bahan baku ayam dan telur 350 ribu rupiah')}
                    className="text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                  >
                    <span className="font-semibold text-emerald-800 block">Bahan Baku:</span>
                    "Beli bahan baku ayam dan telur 350 ribu rupiah"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyExample('Beli bensin motor operasional dan gas elpiji 120 ribu')}
                    className="text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                  >
                    <span className="font-semibold text-emerald-800 block">Gas / Bahan Bakar:</span>
                    "Beli bensin motor operasional dan gas elpiji 120 ribu"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyExample('Token listrik PLN toko 250 ribu')}
                    className="text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                  >
                    <span className="font-semibold text-emerald-800 block">Listrik &amp; Air:</span>
                    "Token listrik PLN toko 250 ribu"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyExample('Gaji harian kasir dan barista 200 ribu')}
                    className="text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                  >
                    <span className="font-semibold text-emerald-800 block">Gaji Karyawan:</span>
                    "Gaji harian kasir dan barista 200 ribu"
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Result Preview & Confirmation Form */}
          {parsedResult && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-slate-800 text-sm">
                    Konfirmasi Hasil Parsing AI
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 uppercase">
                  {parsedResult.type === 'closing' ? 'Setoran Closing' : 'Pengeluaran'}
                </span>
              </div>

              {parsedResult.type === 'closing' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Uang Fisik Tunai (Cash)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-medium text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={editCash || ''}
                        onChange={(e) => setEditCash(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Non-Tunai (QRIS / Transfer / EDC)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-medium text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={editNonCash || ''}
                        onChange={(e) => setEditNonCash(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Shift</label>
                    <select
                      value={editShift}
                      onChange={(e) => setEditShift(e.target.value as ShiftType)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="Pagi">Pagi</option>
                      <option value="Siang">Siang</option>
                      <option value="Malam">Malam</option>
                      <option value="Full-Day">Full-Day</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Total Setoran</label>
                    <div className="px-3 py-1.5 bg-emerald-100/70 border border-emerald-300 rounded-lg font-bold text-emerald-900">
                      Rp {(editCash + editNonCash).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Catatan</label>
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">
                      Kategori Pengeluaran (7 Kategori Standar)
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ExpenseCategory)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Jumlah Pengeluaran
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-medium text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={editExpenseAmount || ''}
                        onChange={(e) => setEditExpenseAmount(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Nama Pengeluaran / Item
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Catatan</label>
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setParsedResult(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold"
                >
                  Batal / Reset
                </button>
                <button
                  type="button"
                  onClick={handleFinalSave}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md inline-flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  Simpan Transaksi (Dengan Suara TTS)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
