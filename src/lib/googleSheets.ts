import { ClosingRecord, ExpenseRecord, AppSettings } from '../types';

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script Webhook & Auto-Backup
 * Pasang di Google Spreadsheet: Extensions > Apps Script
 * Deploy: New Deployment > Web app > Execute as: Me > Who has access: Anyone
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Sheet1 / Ringkasan & Transaksi Utama dengan kolom kustom:
    // UANG MODAL, UANG MASUK, UANG KELUAR, SALDO BERSIH, PENDING, NAMA USER, TANGGAL, KETERANGAN
    var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
    if (sheet1.getName() !== 'Sheet1') {
      sheet1.setName('Sheet1');
    }
    if (sheet1.getLastRow() === 0) {
      sheet1.appendRow([
        'UANG MODAL', 'UANG MASUK', 'UANG KELUAR', 'SALDO BERSIH', 'PENDING', 'NAMA USER', 'TANGGAL', 'JENIS / KATEGORI', 'KETERANGAN', 'JUMLAH (Rp)'
      ]);
      sheet1.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#4F46E5').setFontColor('#FFFFFF');
    }

    if (data.type === 'export_all' && data.records) {
      if (sheet1.getLastRow() > 1) {
        sheet1.getRange(2, 1, sheet1.getLastRow() - 1, sheet1.getLastColumn()).clearContent();
      }
      var records = data.records;
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        sheet1.appendRow([
          rec.uangModal || 0,
          rec.uangMasuk || 0,
          rec.uangKeluar || 0,
          rec.saldoBersih || 0,
          rec.pending || 0,
          rec.userName || '',
          rec.date || '',
          rec.type || '',
          rec.title || rec.notes || '',
          rec.amount || 0
        ]);
      }
    } else if (data.type === 'closing') {
      var sheetMasuk = ss.getSheetByName('Uang Masuk') || ss.insertSheet('Uang Masuk');
      if (sheetMasuk.getLastRow() === 0) {
        sheetMasuk.appendRow([
          'Timestamp', 'ID', 'Tanggal', 'Nama Kasir', 'Shift', 'Fisik Tunai', 'Non-Tunai', 'Total Masuk', 'Target POS', 'Selisih', 'Status', 'Catatan'
        ]);
        sheetMasuk.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#10B981').setFontColor('#FFFFFF');
      }
      var totalMasuk = (Number(data.cashAmount) || 0) + (Number(data.nonCashAmount) || 0);
      sheetMasuk.appendRow([
        new Date(), data.id || '', data.date || '', data.cashierName || '', data.shift || '',
        Number(data.cashAmount) || 0, Number(data.nonCashAmount) || 0, totalMasuk,
        Number(data.expectedPosAmount) || 0, Number(data.discrepancyAmount) || 0,
        data.status || 'pending', data.notes || ''
      ]);

      sheet1.appendRow([
        data.uangModal || 0,
        totalMasuk,
        0,
        data.saldoBersih || 0,
        data.pendingCount || 0,
        data.cashierName || '',
        data.date || '',
        'UANG MASUK (CLOSING)',
        data.notes || 'Setoran kasir shift ' + (data.shift || ''),
        totalMasuk
      ]);

    } else if (data.type === 'expense') {
      var sheetKeluar = ss.getSheetByName('Pengeluaran') || ss.insertSheet('Pengeluaran');
      if (sheetKeluar.getLastRow() === 0) {
        sheetKeluar.appendRow([
          'Timestamp', 'ID', 'Tanggal', 'Kategori', 'Nama Pengeluaran', 'Jumlah (Rp)', 'Dicatat Oleh', 'Catatan'
        ]);
        sheetKeluar.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#EF4444').setFontColor('#FFFFFF');
      }
      sheetKeluar.appendRow([
        new Date(), data.id || '', data.date || '', data.category || '', data.title || '',
        Number(data.amount) || 0, data.recordedByName || 'Admin', data.notes || ''
      ]);

      sheet1.appendRow([
        data.uangModal || 0,
        0,
        Number(data.amount) || 0,
        data.saldoBersih || 0,
        data.pendingCount || 0,
        data.recordedByName || 'Admin',
        data.date || '',
        'PENGELUARAN (' + (data.category || '') + ')',
        data.title || data.notes || '',
        Number(data.amount) || 0
      ]);
    } else if (data.type === 'revoke_user') {
      var sheetBlacklist = ss.getSheetByName('Kasir Nonaktif') || ss.insertSheet('Kasir Nonaktif');
      if (sheetBlacklist.getLastRow() === 0) {
        sheetBlacklist.appendRow([
          'Timestamp', 'UID Kasir', 'Nama Kasir', 'Status', 'Keterangan'
        ]);
        sheetBlacklist.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#991B1B').setFontColor('#FFFFFF');
      }
      sheetBlacklist.appendRow([
        new Date(), data.uid || '', data.cashierName || '', 'NONAKTIF / REVOKED', data.reason || 'Sesi dicabut oleh Admin'
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Data berhasil disinkronkan ke Google Sheets' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook BukuKas Pro & Keuangan AI Aktif!");
}
`;

// Post transaction data to Webhook URL
export async function sendToGoogleSheetsWebhook(
  webhookUrl: string,
  payload: { type: 'closing' | 'expense' | 'export_all' | 'revoke_user' } & Record<string, any>
): Promise<{ success: boolean; message?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'URL Webhook Google Sheets belum diatur.' };
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return { success: true, message: 'Terkirim ke Google Sheets Webhook' };
  } catch (error) {
    console.warn('Google Sheets Webhook error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Gagal mengirim ke webhook' };
  }
}

// Batch export all records to Google Sheets webhook
export async function exportAllToGoogleSheets(
  webhookUrl: string,
  closings: ClosingRecord[],
  expenses: ExpenseRecord[],
  settings: AppSettings
): Promise<{ success: boolean; message?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'URL Webhook belum diatur.' };
  }

  const uangModal = Number(settings.initialCapital || 0);
  const totalMasuk = closings
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + (c.cashAmount || 0) + (c.nonCashAmount || 0), 0);
  const totalKeluar = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingCount = closings.filter((c) => c.status === 'pending').length;
  const saldoBersih = uangModal + totalMasuk - totalKeluar;

  const records: any[] = [];

  // Add closings
  closings.forEach((c) => {
    const masuk = (c.cashAmount || 0) + (c.nonCashAmount || 0);
    records.push({
      uangModal,
      uangMasuk: masuk,
      uangKeluar: 0,
      saldoBersih,
      pending: pendingCount,
      userName: c.cashierName || 'Kasir',
      date: c.date,
      type: 'UANG MASUK (CLOSING - ' + (c.shift || 'Pagi') + ')',
      title: c.notes || 'Setoran kasir',
      amount: masuk
    });
  });

  // Add expenses
  expenses.forEach((e) => {
    records.push({
      uangModal,
      uangMasuk: 0,
      uangKeluar: e.amount || 0,
      saldoBersih,
      pending: pendingCount,
      userName: e.recordedByName || 'Admin',
      date: e.date,
      type: 'PENGELUARAN (' + (e.category || 'Operasional') + ')',
      title: e.title || e.notes || '',
      amount: e.amount || 0
    });
  });

  return sendToGoogleSheetsWebhook(webhookUrl, {
    type: 'export_all',
    records,
    uangModal,
    totalMasuk,
    totalKeluar,
    saldoBersih,
    pendingCount
  });
}

// Generate direct WhatsApp closing summary link for Admin notification
export function createWhatsAppNotificationUrl(
  adminPhone: string,
  closing: ClosingRecord,
  businessName: string = 'EMONG RAMEN HOUSE',
  activeCashierName?: string
): string {
  const rawDigits = (adminPhone || '085694528073').replace(/[^0-9]/g, '');
  const cleanPhone = rawDigits.startsWith('0')
    ? '62' + rawDigits.slice(1)
    : rawDigits.startsWith('62')
      ? rawDigits
      : '62' + rawDigits;

  const total = (closing.cashAmount || 0) + (closing.nonCashAmount || 0);
  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  let cashier = activeCashierName?.trim() || closing.cashierName;
  if (!cashier || cashier === 'Siti Rahma' || cashier === 'Kasir') {
    cashier = activeCashierName?.trim() || 'Emong Kasir';
  }

  const message = `🔔 *NOTIFIKASI CLOSING SHIFT - ${businessName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━
📅 *Tanggal:* ${closing.date}
👤 *Kasir:* ${cashier} (Shift ${closing.shift})
⏰ *Waktu:* ${new Date(closing.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB

💵 *Fisik Tunai:* ${formatRp(closing.cashAmount)}
💳 *Non-Tunai (QRIS/EDC):* ${formatRp(closing.nonCashAmount)}
💰 *TOTAL UANG MASUK:* ${formatRp(total)}

🎯 *Target POS Sistem:* ${formatRp(closing.expectedPosAmount || 0)}
⚠️ *Selisih:* ${closing.discrepancyAmount === 0 ? '✅ SESUAI (Rp 0)' : `${closing.discrepancyAmount > 0 ? 'Lebih +' : 'Kurang '}${formatRp(closing.discrepancyAmount)}`}
${closing.discrepancyReason ? `📝 *Alasan Selisih:* ${closing.discrepancyReason}\n` : ''}${closing.notes ? `💬 *Catatan:* ${closing.notes}\n` : ''}📌 *Status:* Menunggu Validasi & Approval Admin.
━━━━━━━━━━━━━━━━━━`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// Send alert to Telegram Bot if bot token and chat id are set
export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Telegram send failed:', err);
    return false;
  }
}
