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

// IMPORT ASSETS
import logoBuhun from '../assets/images/pwa_icon_1792480156073.jpg';
import ramenBg from '../assets/images/pwa_icon_ramenhouse_bg.jpg';

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
    <div 
      className="min-h-[100dvh] w-full max-w-full overflow-x-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 5, 8, 0.78), rgba(15, 5, 8, 0.88)), url(${ramenBg})`
      }}
    >
      {/* Top Banner / Store Contact */}
      <div className="w-full max-w-md mx-auto pt-2 flex items-center justify-between text-xs text-amber-200/90 z-10">
        <span className="font-bold tracking-wide flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/70 border border-rose-800/40 backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Sistem Kasir Terproteksi
        </span>
        <a
          href={`https://wa.me/${cleanPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-red-950/70 hover:bg-red-900/80 text-amber-300 px-3 py-1 rounded-full border border-rose-800/40 backdrop-blur-md transition-colors font-semibold"
        >
          <Phone className="w-3 h-3 text-amber-400" />
          <span>WA: {settings.whatsappAdminPhone || '085694528073'}</span>
        </a>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6 z-10">
        <div className="bg-[#1c080c]/85 backdrop-blur-xl border border-rose-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80">
          
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-block p-1 rounded-2xl bg-gradient-to-b from-amber-400 to-red-600 shadow-xl mb-3">
              <img 
                src={logoBuhun} 
                alt="Buhun Ramen House" 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-red-950 shadow-inner" 
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase">
              {settings.businessName || 'EMONG RAMEN HOUSE'}
            </h1>
            <p className="text-xs sm:text-sm text-amber-200/90 font-semibold mt-1">
              {settings.tagline || 'System Kasir & Manajemen'}
            </p>
            <p className="text-[11px] text-slate-300/70 mt-1">
              Silakan login dengan akun Admin atau Kasir untuk melanjutkan
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-600/60 text-rose-200 text-xs font-semibold flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email */}
            <div>
              <label className="block text-xs font-bold text-amber-100/90 uppercase tracking-wider mb-1.5">
                Username atau Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400/80">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Username atau Email"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-rose-900/50 rounded-xl text-white placeholder-slate-400 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-amber-100/90 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400/80">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password Anda"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 bg-slate-950/80 border border-rose-900/50 rounded-xl text-white placeholder-slate-400 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-amber-200 transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-amber-400" />
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
              className="w-full min-h-[46px] mt-2 py-3.5 px-4 bg-gradient-to-r from-red-600 via-rose-700 to-red-800 hover:from-red-700 hover:to-rose-900 active:scale-[0.98] text-amber-100 font-extrabold text-sm rounded-xl shadow-lg shadow-red-950/50 border border-rose-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-200/30 border-t-amber-200 rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-amber-300" />
                  <span>Masuk</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer Branding */}
      <footer className="w-full max-w-md mx-auto pb-2 text-center text-xs text-amber-200/60 z-10">
        <p className="font-bold text-amber-100/90 uppercase tracking-wider">
          {settings.businessName || 'EMONG RAMEN HOUSE'}
        </p>
        <p className="text-[11px] text-amber-200/60 mt-0.5">
          WhatsApp Pemilik: {settings.whatsappAdminPhone || '085694528073'} • Mode Layar Penuh HP (PWA)
        </p>
      </footer>
    </div>
  );
}
