/**
 * Firebase Admin SDK: User Session Revocation & Account Deletion Script
 * 
 * Script ini digunakan oleh Admin untuk:
 * 1. Mencabut seluruh refresh token aktif kasir secara instan (revokeRefreshTokens).
 *    Token JWT kasir di semua perangkat (HP, tablet, laptop) akan langsung ditolak oleh server Firebase.
 * 2. Menghapus akun dari Firebase Authentication (bukan hanya Firestore).
 * 3. Menandai status user di Firestore menjadi 'disabled' / soft-deleted agar riwayat transaksi tetap terjaga.
 * 
 * Cara Penggunaan:
 * 1. Unduh service account key dari Firebase Console:
 *    Project Settings > Service accounts > Generate new private key (simpan sebagai serviceAccountKey.json).
 * 2. Jalankan perintah:
 *    node scripts/revoke-firebase-user.js <UID_KASIR>
 *    Contoh:
 *    node scripts/revoke-firebase-user.js XyZ123abc456
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Coba muat service account key jika tersedia
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  // Menggunakan default credentials jika dijalankan di Google Cloud / environment dengan GOOGLE_APPLICATION_CREDENTIALS
  admin.initializeApp();
}

/**
 * Mencabut seluruh sesi token dan menghapus user dari Firebase Authentication
 * @param {string} uid - UID dari akun kasir yang ingin dicabut/dihapus
 * @param {boolean} [deleteFromAuth=true] - Apakah user juga dihapus permanen dari Firebase Auth
 */
async function revokeAndDeactivateUser(uid, deleteFromAuth = true) {
  if (!uid) {
    console.error('Error: Masukkan UID pengguna. Contoh: node revoke-firebase-user.js <UID>');
    process.exit(1);
  }

  console.log(`[1/3] Memulai pencabutan sesi untuk UID: ${uid}...`);

  try {
    // 1. Cabut semua refresh token aktif di semua perangkat
    await admin.auth().revokeRefreshTokens(uid);
    console.log(`✅ Sesi token untuk UID: ${uid} berhasil dicabut (revokeRefreshTokens sukses).`);

    // 2. Tandai status disabled di Firestore (Soft-Delete & Audit)
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      isActive: false,
      status: 'disabled',
      disabledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`✅ Status user di Firestore berhasil diperbarui menjadi 'disabled'.`);

    // Catat ke audit log
    await db.collection('audit_logs').add({
      action: 'ADMIN_SDK_REVOKE_USER',
      targetUid: uid,
      timestamp: new Date().toISOString(),
      details: `Admin mencabut token sesi dan menonaktifkan akun kasir (UID: ${uid})`
    });

    // 3. Opsi: Hapus dari Firebase Authentication
    if (deleteFromAuth) {
      await admin.auth().deleteUser(uid);
      console.log(`✅ Akun UID: ${uid} berhasil dihapus permanen dari Firebase Authentication.`);
    }

    console.log('🎉 Operasi keamanan selesai. Kasir tidak dapat lagi mengakses sistem.');
  } catch (error) {
    console.error('❌ Terjadi kesalahan:', error.message);
    process.exit(1);
  }
}

// Jalankan fungsi jika dieksekusi dari command line
const targetUid = process.argv[2];
if (targetUid) {
  revokeAndDeactivateUser(targetUid);
}

module.exports = { revokeAndDeactivateUser };
