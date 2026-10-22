import React from 'react';
import {
  BarChart3,
  CheckCircle,
  PlusCircle,
  FileText,
  Settings,
  Sparkles,
  FileSpreadsheet,
  Mic,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface BottomNavProps {
  activeTab: 'dashboard' | 'approvals' | 'expenses' | 'reports' | 'cashiers' | 'audit' | 'settings';
  setActiveTab: (tab: any) => void;
  pendingClosingsCount?: number;
  onOpenVoice?: () => void;
}

export function BottomNav({
  activeTab,
  setActiveTab,
  pendingClosingsCount = 0,
  onOpenVoice
}: BottomNavProps) {
  const { isAdmin, isCashier, settings } = useAuth();

  // Admin 5 Primary Mobile Tabs
  const adminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'approvals', label: 'Approval', icon: CheckCircle, badge: pendingClosingsCount },
    { id: 'expenses', label: 'Pengeluaran', icon: PlusCircle },
    { id: 'reports', label: 'Laporan', icon: FileText },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#1e0a0f]/95 backdrop-blur-xl border-t border-rose-900/50 shadow-[0_-6px_25px_rgba(0,0,0,0.5)] px-1.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)] transition-all"
    >
      <div className="max-w-md mx-auto flex items-center justify-around gap-1">
        {isAdmin ? (
          adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-b from-red-600/30 to-rose-950/60 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-rose-200/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'scale-110 text-amber-300' : 'text-rose-200/70'
                    }`}
                  />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center border border-white/30 animate-pulse shadow-xs">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span
                  className={`text-[10px] mt-1 tracking-tight leading-none whitespace-nowrap ${
                    isActive ? 'font-black text-amber-200' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5 animate-pulse" />
                )}
              </button>
            );
          })
        ) : (
          /* Kasir Mobile Bottom Navigation */
          <>
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl bg-gradient-to-b from-red-600/30 to-rose-950/60 text-amber-300 border border-amber-500/40 shadow-xs cursor-pointer select-none active:scale-95"
            >
              <DollarSign className="w-5 h-5 text-amber-300 scale-110" />
              <span className="text-[10px] font-black mt-1 text-amber-200 leading-none">
                Closing Shift
              </span>
              <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />
            </button>

            {onOpenVoice && (
              <button
                type="button"
                onClick={onOpenVoice}
                className="flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-rose-200/70 hover:text-white hover:bg-white/5 transition-all cursor-pointer select-none active:scale-95"
              >
                <Mic className="w-5 h-5 text-amber-400 animate-pulse" />
                <span className="text-[10px] font-bold mt-1 text-amber-100 leading-none">
                  Voice AI
                </span>
              </button>
            )}

            {settings.spreadsheetUrl && (
              <a
                href={settings.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-emerald-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer select-none active:scale-95"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span className="text-[10px] font-bold mt-1 text-emerald-200 leading-none">
                  Sheets
                </span>
              </a>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
