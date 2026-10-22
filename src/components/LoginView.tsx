import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Phone,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginView() {
  const { loginWithEmailOrUsername, settings, authSecurityError, clearAuthSecurityError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoSrc, setLogoSrc] = useState('/logo.png');

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
      className="min-h-[100dvh] w-full max-w-full overflow-x-hidden flex flex-col justify-center p-4 sm:p-6 lg:p-8 relative bg-cover bg-center bg-fixed"
      style={{
        backgroundColor: '#7f1d1d',
        backgroundImage: `linear-gradient(to bottom, rgba(15, 5, 8, 0.78), rgba(15, 5, 8, 0.88)), url('/ramen-bg.jpg')`
      }}
    >
      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6 z-10">
        <div className="bg-white/95 backdrop-blur-xl border border-rose-900/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black">
          
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-block p-1 rounded-2xl bg-gradient-to-b from-amber-400 to-red-600 shadow-xl mb-3">
              <img 
                src={logoSrc} 
                alt="Buhun Ramen House" 
                onError={() => {
                  if (logoSrc !== '/logo.svg') {
                    setLogoSrc('/logo.svg');
                  }
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-red-950 shadow-inner" 
              />
            </div>
            
            {/* Judul Utama - Hitam Pekat & Bold */}
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black uppercase">
              {settings.businessName || 'EMONG RAMEN HOUSE'}
            </h1>
            
            {/* Subjudul Tagline - Merah Marun Pekat */}
            <p className="text-xs sm:text-sm text-red-900 font-extrabold mt-1 tracking-wide">
              {settings.tagline || 'System Kasir & Manajemen'}
            </p>
            
            {/* Petunjuk Login - Hitam Pekat Jelas */}
            <p className="text-xs text-black font-bold mt-1.5 leading-normal">
              Silakan login dengan akun Admin atau Kasir untuk melanjutkan
            </p>
          </div>

          {/* Security Alert (Session Revoked / Deactivated Account) */}
          {authSecurityError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start justify-between gap-2.5 shadow-lg shadow-amber-950/40">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-bold text-amber-300">Pemberitahuan Keamanan:</p>
                  <p className="leading-relaxed text-amber-200/90">{authSecurityError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearAuthSecurityError}
                className="text-amber-400/80 hover:text-amber-200 text-[10px] underline ml-1 shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-100 border border-rose-400 text-rose-900 text-xs font-bold flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email */}
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                Username atau Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Username atau Email"
                  autoComplete="username"
                  style={{ WebkitUserSelect: 'text', userSelect: 'text', touchAction: 'manipulation' }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-black placeholder-slate-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black text-black uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password Anda"
                  autoComplete="current-password"
                  style={{ WebkitUserSelect: 'text', userSelect: 'text', touchAction: 'manipulation' }}
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-black placeholder-slate-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-black transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-red-600" />
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
              className="w-full min-h-[46px] mt-2 py-3.5 px-4 bg-gradient-to-r from-red-600 via-rose-700 to-red-800 hover:from-red-700 hover:to-rose-900 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-red-950/40 border border-rose-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
    </div>
  );
}
