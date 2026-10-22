import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Shield,
  FileSpreadsheet,
  Mic,
  Cloud,
  ExternalLink,
  X,
  AlertTriangle,
  Database
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '../lib/googleSheets';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetupGuideModal({ isOpen, onClose }: SetupGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'sheets' | 'firebase' | 'voice' | 'deploy'>('sheets');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const sampleRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
        request.auth.token.email == 'pandircmss@gmail.com'
      );
    }

    match /users/{userId} {
      allow get: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow list: if isAdmin();
      allow create, update: if isSignedIn();
    }
    match /admins/{userId} {
      allow read: if isSignedIn();
      allow write: if isAdmin() || request.auth.token.email == 'pandircmss@gmail.com';
    }
    match /closings/{closingId} {
      allow read: if isSignedIn() && (isAdmin() || resource.data.cashierId == request.auth.uid);
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
    }
    match /expenses/{expenseId} {
      allow read, write: if isAdmin();
    }
    match /audit_logs/{logId} {
      allow create: if isSignedIn();
      allow read: if isAdmin();
      allow update, delete: if false;
    }
    match /settings/{settingId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(sampleRules);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">
                Panduan Konfigurasi Lengkap (Setup Guide)
              </h3>
              <p className="text-xs text-slate-500">
                Langkah demi langkah integrasi Firebase, Google Sheets, Voice AI &amp; Deployment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            1. Google Sheets &amp; Webhook
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'firebase'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            2. Firebase Auth &amp; Security Rules
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'voice'
                ? 'border-rose-600 text-rose-700 bg-rose-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mic className="w-4 h-4" />
            3. Pengujian Voice AI
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'deploy'
                ? 'border-amber-600 text-amber-700 bg-amber-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4" />
            4. Panduan Deploy Gratis
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-slate-700 text-sm">
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-xs">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Alur Integrasi Google Sheets Webhook Otomatis
                </h4>
                <p>
                  Setiap transaksi baru dari Kasir (Closing Shift) atau Admin (Pengeluaran) akan otomatis
                  terkirim ke Google Sheets via Google Apps Script sebagai baris baru (append row),
                  serta memiliki skrip auto-backup harian ke Google Drive!
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Langkah-Langkah Pemasangan:
                </h5>
                <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed">
                  <li>
                    Buka Google Drive Anda, buat spreadsheet baru dengan nama: <strong>BukuKas Keuangan Bisnis</strong>.
                  </li>
                  <li>
                    Di spreadsheet tersebut, klik menu <strong>Extensions (Ekstensi)</strong> &gt; <strong>Apps Script</strong>.
                  </li>
                  <li>
                    Hapus kode bawaan (jika ada), lalu <strong>paste kode skrip di bawah ini</strong> ke editor Apps Script.
                  </li>
                  <li>
                    Klik tombol <strong>Deploy (Terapkan)</strong> di pojok kanan atas &gt; pilih <strong>New deployment (Penerapan baru)</strong>.
                  </li>
                  <li>
                    Pilih tipe gear ⚙️ <strong>Web app</strong>:
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600">
                      <li><strong>Execute as:</strong> Me (email Anda)</li>
                      <li><strong>Who has access:</strong> Anyone (Siapa saja)</li>
                    </ul>
                  </li>
                  <li>
                    Klik <strong>Deploy</strong>, izinkan akses Google (Review permissions), lalu <strong>salin Web App URL</strong> (berakhiran <code>/exec</code>).
                  </li>
                  <li>
                    Kembali ke aplikasi ini, buka menu <strong>Admin &gt; Pengaturan &amp; Integrasi</strong>, lalu tempel <strong>Web App URL</strong> dan <strong>Link Spreadsheet</strong> Anda.
                  </li>
                </ol>
              </div>

              {/* Code Box with Copy */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Skrip Google Apps Script (doPost, doGet, &amp; Auto-Backup Drive):
                  </span>
                  <button
                    onClick={handleCopyScript}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'Tersalin!' : 'Salin Kode Skrip'}
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-56 leading-relaxed">
                  {GOOGLE_APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>

              {/* Auto Backup Info */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                <span className="font-bold block mb-1">⏱️ Cara Mengaktifkan Auto-Backup Harian di Google Drive:</span>
                Di Apps Script editor, klik ikon <strong>Jam (Triggers)</strong> di sidebar kiri &gt; klik <strong>Add Trigger</strong>:
                <br />
                Pilih fungsi: <code>autoBackupSpreadsheetToDrive</code> &gt; Event source: <strong>Time-driven</strong> &gt; Type: <strong>Day timer</strong> (misal pukul 00:00 - 01:00). File cadangan akan otomatis tersimpan rapi di folder Google Drive Anda setiap malam!
              </div>
            </div>
          )}

          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 text-xs">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Pengaturan Firebase Authentication &amp; Firestore Security Rules
                </h4>
                <p>
                  Aplikasi ini menggunakan sistem hak akses Role-Based Access Control (RBAC) yang ketat. Kasir
                  hanya dapat mencatat setoran hari ini dan tidak dapat melihat laporan laba atau pengeluaran.
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  1. Membuat Akun Kasir &amp; Admin di Firebase Console:
                </h5>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs leading-relaxed">
                  <li>
                    Buka <strong>Firebase Console</strong> (<code>console.firebase.google.com</code>) &gt; pilih project Anda.
                  </li>
                  <li>
                    Masuk ke menu <strong>Build &gt; Authentication &gt; Sign-in method</strong>:
                    <ul className="list-disc pl-5 mt-0.5">
                      <li>Aktifkan <strong>Email/Password</strong></li>
                      <li>Aktifkan <strong>Google Sign-In</strong> (opsional jika ingin login dengan akun Google)</li>
                    </ul>
                  </li>
                  <li>
                    Pada tab <strong>Users</strong>, klik <strong>Add user</strong>:
                    <ul className="list-disc pl-5 mt-0.5 space-y-1">
                      <li>
                        <strong>Akun Admin:</strong> Daftarkan email Anda (misal: <code>pandircmss@gmail.com</code> atau email pemilik).
                      </li>
                      <li>
                        <strong>Akun Kasir:</strong> Buat email untuk kasir (misal: <code>kasir1@toko.com</code>, <code>kasir2@toko.com</code>).
                      </li>
                    </ul>
                  </li>
                  <li>
                    Di Firestore Database, koleksi <code>users/{'{userId}'}</code> menyimpan dokumen user dengan field <code>role: "admin"</code> atau <code>role: "cashier"</code>.
                  </li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Firestore Security Rules (firestore.rules) yang Sudah Terpasang:
                  </span>
                  <button
                    onClick={handleCopyRules}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedRules ? 'Tersalin!' : 'Salin Rules'}
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-52 leading-relaxed">
                  {sampleRules}
                </pre>
              </div>

              {/* Security & Token Revocation Guide */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2">
                <span className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Shield className="w-4 h-4 text-amber-600" />
                  Mencabut Sesi Login Kasir (Revoke Token) &amp; Hapus Akun Firebase Auth:
                </span>
                <p className="leading-relaxed">
                  Jika karyawan kasir berhenti bekerja, Admin dapat menonaktifkan akun kasir langsung dari tab <strong>Manajemen Kasir</strong>. Sistem dilengkapi <strong>Real-time Auth Guard</strong> yang otomatis memutus sesi kasir di perangkat mereka dalam hitungan detik.
                </p>
                <p className="leading-relaxed">
                  Untuk membatalkan token di tingkat server Firebase Authentication secara instan melalui Node.js Admin SDK:
                </p>
                <div className="p-2 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px]">
                  node scripts/revoke-firebase-user.js &lt;UID_KASIR&gt;
                </div>
                <p className="text-[11px] text-amber-800">
                  Perintah ini mengeksekusi <code>admin.auth().revokeRefreshTokens(uid)</code> dan <code>admin.auth().deleteUser(uid)</code> sehingga seluruh token aktif di semua browser/perangkat kasir langsung ditolak oleh server Firebase.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 text-xs">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-rose-600" />
                  Panduan Pengujian Voice AI (Speech-to-Text &amp; NLP Parsing)
                </h4>
                <p>
                  Voice AI menggunakan Web Speech API native browser yang dipadukan dengan parser NLP Bahasa Indonesia dan model Gemini untuk mengenali angka dan 7 kategori secara akurat.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    💻 Di Laptop / Desktop Browser:
                  </span>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
                    <li>Gunakan <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, atau <strong>Opera</strong>.</li>
                    <li>Saat pertama kali menekan tombol mikrofon, klik <strong>"Allow / Izinkan"</strong> pada pop-up izin mikrofon di bilah alamat (URL bar).</li>
                    <li>Pastikan mikrofon laptop tidak dimute.</li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    📱 Di Smartphone (Android / iOS):
                  </span>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
                    <li><strong>Android:</strong> Buka di Chrome Browser. Izinkan akses mikrofon saat diminta.</li>
                    <li><strong>iPhone / iOS:</strong> Buka di Safari. Izinkan prompt mikrofon audio.</li>
                    <li>Aplikasi wajib diakses melalui <strong>HTTPS</strong> atau <code>localhost</code> agar browser mengizinkan akses mikrofon.</li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                <span className="font-bold block mb-1">🎙️ Tips Format Ucapan Suara Agar Akurat:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  <li><strong>Kasir:</strong> Sebutkan nominal tunai &amp; non-tunai, contoh: <em>"Setoran tunai dua juta non tunai lima ratus ribu shift pagi"</em>.</li>
                  <li><strong>Admin:</strong> Sebutkan barang dan nominal belanja, contoh: <em>"Beli bahan baku ayam 350 ribu"</em>, <em>"Beli bensin dan gas elpiji 120 ribu"</em>, <em>"Token listrik 250 ribu"</em>.</li>
                  <li>Sistem akan otomatis mengonversi kata bilangan ("dua juta", "tiga ratus ribu") ke angka murni, lalu menampilkan pop-up konfirmasi sebelum data disimpan.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-xs">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-amber-600" />
                  Cara Deploy Web App Gratis (Vercel, Netlify, atau GitHub Pages)
                </h4>
                <p>
                  Aplikasi ini dirancang menggunakan standar Vite + React + TypeScript sehingga dapat di-deploy
                  ke berbagai platform hosting gratis dalam hitungan menit.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Vercel */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h6 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                    <span>Opsi 1: Deploy ke Vercel (Paling Direkomendasikan - Gratis &amp; Cepat)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Rekomendasi</span>
                  </h6>
                  <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                    <li>Upload folder proyek ini ke repositori GitHub pribadi Anda.</li>
                    <li>Buka <strong>vercel.com</strong> &gt; Login dengan akun GitHub.</li>
                    <li>Klik <strong>Add New Project</strong> &gt; pilih repositori GitHub aplikasi ini.</li>
                    <li>
                      Framework Preset otomatis terdeteksi sebagai <strong>Vite</strong>.
                      <br />Build command: <code>npm run build</code> | Output directory: <code>dist</code>.
                    </li>
                    <li>
                      Di bagian <strong>Environment Variables</strong>, tambahkan <code>GEMINI_API_KEY</code> jika menggunakan fitur AI server.
                    </li>
                    <li>Klik <strong>Deploy</strong>. Selesai! Anda langsung mendapatkan domain HTTPS gratis berakhiran <code>.vercel.app</code>.</li>
                  </ol>
                </div>

                {/* Netlify */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h6 className="font-bold text-slate-800 text-sm">
                    Opsi 2: Deploy ke Netlify
                  </h6>
                  <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                    <li>Buka <strong>netlify.com</strong> &gt; Login dengan GitHub.</li>
                    <li>Pilih <strong>Add new site</strong> &gt; <strong>Import an existing project</strong>.</li>
                    <li>Hubungkan repositori GitHub Anda.</li>
                    <li>Isi Build command: <code>npm run build</code> dan Publish directory: <code>dist</code>.</li>
                    <li>Klik <strong>Deploy Site</strong>. Website langsung online dengan HTTPS gratis.</li>
                  </ol>
                </div>

                {/* WhatsApp Webhook tip */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                  <span className="font-bold block mb-1">📲 Notifikasi WhatsApp &amp; Telegram:</span>
                  Setiap kali Kasir menyelesaikan shift closing, tombol notifikasi WhatsApp otomatis membuat
                  ringkasan pesan berformat rapi (dengan rincian tunai, QRIS, selisih &amp; alasan) yang dapat
                  dikirim langsung ke nomor WhatsApp Owner/Admin dengan 1 klik!
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            BukuKas Pro &amp; Keuangan AI • Terhubung ke Firebase &amp; Google Apps Script
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow transition-colors"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
