import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Sparkles,
  Phone,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginView() {
  const { loginWithEmailOrUsername, settings } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Mohon masukkan Username atau Email.');
      return;
    }
    if (!password) {
      setErrorMsg('Mohon masukkan Password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithEmailOrUsername(identifier.trim(), password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal login. Periksa username dan password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rawPhone = (settings.whatsappAdminPhone || '085694528073').replace(/\D/g, '');
  const cleanPhone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : (rawPhone.startsWith('62') ? rawPhone : '62' + rawPhone);

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Banner / Store Contact */}
      <div className="w-full max-w-md mx-auto pt-2 flex items-center justify-between text-xs text-emerald-400/90">
        <span className="font-semibold tracking-wide flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Sistem Kasir Terproteksi
        </span>
        <a
          href={`https://wa.me/${cleanPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20 transition-colors"
        >
          <Phone className="w-3 h-3" />
          <span>WA: {settings.whatsappAdminPhone || '085694528073'}</span>
        </a>
      </div>

      {/* Main Login Card (Mobile-First Touch Optimized) */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 text-3xl">
              🍜
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              {settings.businessName || 'EMONG RAMEN HAOUSE'}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-400 font-medium mt-1">
              {settings.tagline || 'EMONG RAMEN HAOUSE - System Kasir & Manajemen'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Silakan login dengan akun Admin atau Kasir untuk melanjutkan
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username atau Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Contoh: firman atau firman@emongramen.com"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Password with Show/Hide Eye Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[46px] mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Sistem Kasir</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer Branding & WhatsApp */}
      <footer className="w-full max-w-md mx-auto pb-2 text-center text-xs text-slate-500">
        <p className="font-medium text-slate-400">
          {settings.businessName || 'EMONG RAMEN HOUSE'}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          WhatsApp Pemilik: {settings.whatsappAdminPhone || '085694528073'} • Mode Layar Penuh HP (PWA)
        </p>
      </footer>
    </div>
  );
}
