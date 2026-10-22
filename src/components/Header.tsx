import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  FileSpreadsheet,
  Mic,
  BookOpen,
  LogOut,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Shield,
  Phone,
  Menu,
  X,
  BarChart3,
  CheckCircle,
  PlusCircle,
  FileText,
  ShieldAlert,
  Users,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { ClosingRecord, ExpenseRecord } from '../types';
import { exportAllToGoogleSheets } from '../lib/googleSheets';

interface HeaderProps {
  onOpenVoice: () => void;
  onOpenGuide: () => void;
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
  pendingClosingsCount?: number;
  closings?: ClosingRecord[];
  expenses?: ExpenseRecord[];
  isOnline?: boolean;
}

export function Header({
  onOpenVoice,
  onOpenGuide,
  activeTab,
  setActiveTab,
  pendingClosingsCount = 0,
  closings = [],
  expenses = [],
  isOnline = true
}: HeaderProps) {
  const { userProfile, role, isAdmin, logout, settings } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const phone = settings.whatsappAdminPhone || '085694528073';
  const rawPhone = phone.replace(/\D/g, '');
  const cleanPhone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : (rawPhone.startsWith('62') ? rawPhone : '62' + rawPhone);

  const handleGoogleSheetsClick = async () => {
    if (settings.webhookUrl && closings && expenses) {
      setIsExporting(true);
      try {
        await exportAllToGoogleSheets(settings.webhookUrl, closings, expenses, settings);
      } catch (e) {
        console.warn('Auto export to Google Sheets failed:', e);
      } finally {
        setIsExporting(false);
      }
    }
    const url = settings.spreadsheetUrl || 'https://docs.google.com/spreadsheets';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#1e0a0f]/95 backdrop-blur-md text-white border-b border-rose-900/40 shadow-lg px-2.5 sm:px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 transition-all">
      <div className="w-full mx-auto h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
        
        {/* Logo & Store Branding */}
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          <img 
            src="/logo.png" 
            alt="Buhun Ramen House" 
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.svg'; }}
            className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-lg sm:rounded-xl object-cover border border-amber-500/40 shadow-sm" 
          />

          <div className="min-w-0 flex-1 my-auto">
            <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
              <h1 className="font-extrabold text-white text-xs sm:text-base tracking-tight truncate uppercase m-0 leading-none max-w-[120px] xs:max-w-[160px] sm:max-w-none">
                {settings.businessName || 'EMONG RAMEN HOUSE'}
              </h1>
              <span className="hidden sm:inline-block text-[9px] font-black px-1.5 py-0.5 rounded-xs bg-amber-500 text-slate-950 tracking-wider uppercase shrink-0">
                POS
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  isOnline
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                }`}
                title={isOnline ? 'Terhubung Real-Time ke Firebase Firestore' : 'Mode Offline - Data tersimpan lokal & sinkron otomatis saat online'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span className="hidden sm:inline">{isOnline ? 'Cloud Realtime' : 'Offline'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-amber-200/80 truncate leading-tight mt-0.5">
              <span className="truncate">{settings.tagline || 'System Kasir & Manajemen'}</span>
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-0.5 text-amber-400 hover:text-amber-300 font-semibold shrink-0"
                title="Hubungi WhatsApp Pemilik"
              >
                <Phone className="w-2.5 h-2.5" />
                <span>WA: {phone}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Action Buttons in Header - TEMA RED RAMEN & AMBER */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <PWAInstallButton />

          {/* Voice Button (Red-Rose Theme) */}
          <button
            type="button"
            onClick={onOpenVoice}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-700 to-rose-800 hover:from-red-800 hover:to-rose-900 border border-rose-500/30 text-white text-[10px] sm:text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer min-h-[28px] sm:min-h-[36px]"
            title="Buka Input Suara AI"
          >
            <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0 animate-pulse" />
            <span className="hidden md:inline text-amber-100">Voice</span>
          </button>

          {/* GOOGLE SHEETS BUTTON */}
          <button
            type="button"
            onClick={handleGoogleSheetsClick}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border border-emerald-400/40 text-[10px] sm:text-xs font-bold transition-all min-h-[28px] sm:min-h-[36px] cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm shrink-0"
            title="Buka Spreadsheet Google Sheets & Sinkronkan Data"
          >
            <FileSpreadsheet className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-100 shrink-0 ${isExporting ? 'animate-spin' : ''}`} />
            <span className="font-extrabold whitespace-nowrap">{isExporting ? 'Sync...' : 'Sheets'}</span>
            <ExternalLink className="w-2.5 h-2.5 text-emerald-200 hidden sm:inline" />
          </button>

          {/* Setup Guide Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-rose-800/50 text-amber-100 text-xs font-medium transition-colors min-h-[36px]"
              title="Buka Panduan Setup & Webhook"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Panduan</span>
            </button>
          )}

          {/* User Profile Badge & Logout Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              aria-expanded={showProfileMenu}
              aria-label="Buka Menu Profil Pengguna"
              className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-red-950/80 border border-rose-800/60 text-amber-100 hover:bg-red-900/80 text-xs font-semibold transition-all min-h-[34px] sm:min-h-[36px] cursor-pointer select-none active:scale-95"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-slate-950 text-[11px] font-black shrink-0 shadow-xs">
                {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left hidden md:block">
                <span className="block leading-none text-[9px] text-amber-300/80">
                  {isAdmin ? '👑 Admin' : '💼 Kasir'}
                </span>
                <span className="block font-bold text-xs truncate max-w-[90px] text-white">
                  {userProfile?.displayName || 'Pengguna'}
                </span>
              </div>
              <ChevronDown
                className={`w-3 h-3 text-amber-300/70 hidden sm:block transition-transform duration-200 ${
                  showProfileMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-24px)] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-fade-in">
                  <div className="p-3 border-b border-slate-100 bg-amber-50/50 rounded-xl mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Akun Aktif:
                    </p>
                    <p className="font-bold text-slate-800 text-sm truncate">
                      {userProfile?.displayName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{userProfile?.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAdmin
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isAdmin ? '👑 Full Access (Admin)' : '💼 Shift Kasir (Input Saja)'}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 py-2 text-[11px] text-slate-600 space-y-1">
                    <p className="flex justify-between">
                      <span>Toko:</span>
                      <strong className="text-slate-800 truncate max-w-[150px]">{settings.businessName}</strong>
                    </p>
                    <p className="flex justify-between items-center">
                      <span>Owner WA:</span>
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-red-700 hover:underline"
                      >
                        {phone}
                      </a>
                    </p>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar / Logout Akun
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* HAMBURGER MENU ICON (☰) FOR ADMIN NAV AT FAR RIGHT */}
          {isAdmin && (
            <div className="relative ml-0.5">
              <button
                type="button"
                onClick={() => setShowNavMenu((prev) => !prev)}
                aria-expanded={showNavMenu}
                aria-label="Buka Menu Navigasi Utama"
                className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-amber-100 border border-rose-500/40 shadow-md transition-all flex items-center justify-center cursor-pointer active:scale-95 min-h-[34px] sm:min-h-[36px]"
                title="Menu Navigasi Utama"
              >
                <Menu className="w-5 h-5" />
                {pendingClosingsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center animate-pulse">
                    {pendingClosingsCount}
                  </span>
                )}
              </button>

              {/* Hamburger Dropdown / Slide-out Menu */}
              {showNavMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/40"
                    onClick={() => setShowNavMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-24px)] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 animate-fade-in space-y-1">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between mb-1 bg-amber-50/60 rounded-xl">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Navigasi Utama
                        </p>
                        <p className="font-bold text-xs text-slate-800">Pilih Menu Admin</p>
                      </div>
                      <button
                        onClick={() => setShowNavMenu(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {[
                      { id: 'dashboard', label: 'Dashboard & Grafik', icon: BarChart3 },
                      { id: 'approvals', label: 'Approval Setoran Kasir', icon: CheckCircle, badge: pendingClosingsCount },
                      { id: 'expenses', label: 'Catat Pengeluaran', icon: PlusCircle },
                      { id: 'reports', label: 'Laporan Periodik', icon: FileText },
                      { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
                      { id: 'cashiers', label: 'Manajemen Kasir', icon: Users },
                      { id: 'settings', label: 'Pengaturan & Webhook', icon: Settings },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (setActiveTab) setActiveTab(item.id);
                            setShowNavMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            isActive
                              ? 'bg-red-700 text-amber-100 shadow-sm'
                              : 'text-slate-800 hover:bg-red-50 hover:text-red-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && item.badge > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                              {item.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}

                    <div className="pt-2 mt-1 border-t border-slate-100 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNavMenu(false);
                          handleGoogleSheetsClick();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition-all cursor-pointer border border-emerald-200"
                      >
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>Buka Google Sheets</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNavMenu(false);
                          logout();
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
