import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown, X, Check, Clock } from 'lucide-react';

export type DateRangePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (val: DateRangeValue) => void;
  className?: string;
}

export function computePresetRange(preset: DateRangePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];

  const todayStr = format(now);

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === 'yesterday') {
    const y = new Date(now.getTime() - 86400000);
    const yStr = format(y);
    return { startDate: yStr, endDate: yStr };
  }

  if (preset === 'last7') {
    const d = new Date(now.getTime() - 6 * 86400000);
    return { startDate: format(d), endDate: todayStr };
  }

  if (preset === 'last30') {
    const d = new Date(now.getTime() - 29 * 86400000);
    return { startDate: format(d), endDate: todayStr };
  }

  if (preset === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: format(start), endDate: format(end) };
  }

  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: format(start), endDate: format(end) };
  }

  if (preset === 'thisYear') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { startDate: format(start), endDate: format(end) };
  }

  // 'all' or 'custom'
  return { startDate: '', endDate: '' };
}

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate || new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(value.endDate || new Date().toISOString().split('T')[0]);

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'all', label: 'Semua Periode' },
    { id: 'today', label: 'Hari Ini' },
    { id: 'yesterday', label: 'Kemarin' },
    { id: 'last7', label: '7 Hari Terakhir' },
    { id: 'last30', label: '30 Hari Terakhir' },
    { id: 'thisMonth', label: 'Bulan Ini' },
    { id: 'lastMonth', label: 'Bulan Lalu' },
    { id: 'thisYear', label: 'Tahun Ini' },
    { id: 'custom', label: 'Kustom Rentang' },
  ];

  const handleSelectPreset = (p: DateRangePreset) => {
    if (p === 'custom') {
      onChange({
        preset: 'custom',
        startDate: customStart,
        endDate: customEnd,
      });
      return;
    }

    const { startDate, endDate } = computePresetRange(p);
    onChange({
      preset: p,
      startDate,
      endDate,
    });
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return;
    onChange({
      preset: 'custom',
      startDate: customStart <= customEnd ? customStart : customEnd,
      endDate: customStart <= customEnd ? customEnd : customStart,
    });
    setIsOpen(false);
  };

  // Format label for display
  const getDisplayLabel = () => {
    if (value.preset === 'all') return 'Semua Periode';
    const found = presets.find((p) => p.id === value.preset && p.id !== 'custom');
    if (found) {
      if (value.startDate && value.endDate && value.startDate !== value.endDate) {
        return `${found.label} (${value.startDate} s/d ${value.endDate})`;
      }
      return `${found.label} (${value.startDate})`;
    }
    if (value.startDate && value.endDate) {
      return `${value.startDate} s/d ${value.endDate}`;
    }
    return 'Pilih Rentang Tanggal';
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 text-[11px] sm:text-xs font-semibold text-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer"
      >
        <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
        <span className="truncate max-w-[125px] xs:max-w-[170px] sm:max-w-[260px]">{getDisplayLabel()}</span>
        <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 sm:left-0 mt-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Filter Periode Tanggal
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {presets.map((p) => {
              const isSelected = value.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'bg-slate-50 hover:bg-purple-50 hover:text-purple-700 text-slate-700'
                  }`}
                >
                  <span className="truncate">{p.label}</span>
                  {isSelected && <Check className="w-3 h-3 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Inputs */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Pilih Tanggal Mulai &amp; Selesai:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Mulai</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-[11px] text-slate-800 font-semibold focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Selesai</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-[11px] text-slate-800 font-semibold focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyCustom}
              className="w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Terapkan Rentang Tanggal
            </button>
          </div>
        </div>
      </>
    )}
  </div>
  );
}
