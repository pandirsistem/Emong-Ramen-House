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
}

export function Header({
  onOpenVoice,
  onOpenGuide,
  activeTab,
  setActiveTab,
  pendingClosingsCount = 0,
  closings = [],
  expenses = []
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Logo & Store Branding */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1 sm:flex-initial">
          <div className="w-7 h-7 sm:w-10 sm:h-10 shrink-0 rounded-lg sm:rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 text-sm sm:text-xl">
            🍜
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <h1 className="font-black text-slate-900 text-xs sm:text-base tracking-tight whitespace-nowrap uppercase">
                {settings.businessName || 'EMONG RAMEN HOUSE'}
              </h1>
              <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-emerald-100 text-emerald-800 tracking-wider uppercase shrink-0">
                POS
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 truncate">
              <span className="truncate">{settings.tagline || 'System Kasir & Manajemen'}</span>
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-emerald-700 hover:text-emerald-800 font-semibold shrink-0"
                title="Hubungi WhatsApp Pemilik"
              >
                <Phone className="w-2.5 h-2.5" />
                <span>WA: {phone}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <PWAInstallButton />

          {/* Voice AI Button */}
          <button
            type="button"
            onClick={onOpenVoice}
            className="inline-flex items-center justify-center gap-1 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] sm:text-xs font-bold shadow-xs shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer min-h-[32px] sm:min-h-[36px]"
            title="Buka Input Suara AI"
          >
            <Mic className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span className="hidden md:inline">Voice AI</span>
          </button>

          {/* ADMIN ONLY: Google Sheets Direct Hyperlink & Sync */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleGoogleSheetsClick}
              disabled={isExporting}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold transition-colors min-h-[36px] cursor-pointer disabled:opacity-50"
              title="Sinkronkan Data ke Google Sheets & Buka Spreadsheet"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-600 ${isExporting ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">{isExporting ? 'Syncing...' : 'Google Sheets'}</span>
              <ExternalLink className="w-2.5 h-2.5 text-emerald-500 ml-0.5" />
            </button>
          )}

          {/* Setup Guide Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors min-h-[36px]"
              title="Buka Panduan Setup & Webhook"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
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
              className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition-all min-h-[34px] sm:min-h-[36px] cursor-pointer select-none active:scale-95 ${
                isAdmin
                  ? 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100 focus:ring-2 focus:ring-purple-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 focus:ring-2 focus:ring-emerald-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${
                  isAdmin ? 'bg-purple-600' : 'bg-emerald-600'
                }`}
              >
                {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left hidden md:block">
                <span className="block leading-none text-[10px] opacity-75">
                  {isAdmin ? '👑 Admin' : '💼 Kasir'}
                </span>
                <span className="block font-bold text-xs truncate max-w-[90px]">
                  {userProfile?.displayName || 'Pengguna'}
                </span>
              </div>
              <ChevronDown
                className={`w-3 h-3 opacity-60 hidden sm:block transition-transform duration-200 ${
                  showProfileMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/5"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-fade-in">
                  <div className="p-3 border-b border-slate-100 bg-slate-50 rounded-xl mb-2">
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
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isAdmin ? '👑 Full Access (Admin)' : '💼 Shift Kasir (Input Saja)'}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 py-2 text-[11px] text-slate-500 space-y-1">
                    <p className="flex justify-between">
                      <span>Toko:</span>
                      <strong className="text-slate-700 truncate max-w-[150px]">{settings.businessName}</strong>
                    </p>
                    <p className="flex justify-between items-center">
                      <span>Owner WA:</span>
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-emerald-600 hover:underline"
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
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setShowNavMenu((prev) => !prev)}
                aria-expanded={showNavMenu}
                aria-label="Buka Menu Navigasi Utama"
                className="p-2 sm:p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center shadow-sm cursor-pointer active:scale-95 min-h-[34px] sm:min-h-[36px]"
                title="Menu Navigasi Utama"
              >
                <Menu className="w-5 h-5" />
                {pendingClosingsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                    {pendingClosingsCount}
                  </span>
                )}
              </button>

              {/* Hamburger Dropdown / Slide-out Menu */}
              {showNavMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/10"
                    onClick={() => setShowNavMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 animate-fade-in space-y-1">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between mb-1 bg-slate-50 rounded-xl">
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
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-purple-50 hover:text-purple-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && item.badge > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                              {item.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}

                    <div className="pt-2 mt-1 border-t border-slate-100">
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
