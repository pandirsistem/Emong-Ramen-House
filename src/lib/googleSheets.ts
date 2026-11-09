import { ClosingRecord, ExpenseRecord, AppSettings } from '../types';

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script Webhook & Auto-Backup (Two-Way Sync: Update & Delete support)
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

    // Kolom: A: UANG MODAL, B: UANG MASUK, C: UANG KELUAR, D: SALDO BERSIH, E: PENDING, F: NAMA USER, G: TANGGAL, H: JENIS / KATEGORI, I: KETERANGAN, J: JUMLAH (Rp)
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
        var idTag = rec.id ? '[ID:' + rec.id + '] ' : '';
        sheet1.appendRow([
          Number(rec.uangModal) || 0,
          Number(rec.uangMasuk) || 0,
          Number(rec.uangKeluar) || 0,
          Number(rec.saldoBersih) || 0,
          Number(rec.pending) || 0,
          rec.userName || '',
          rec.date || '',
          rec.type || '',
          idTag + (rec.title || rec.notes || ''),
          Number(rec.amount) || 0
        ]);
      }
    } else if (data.type === 'closing') {
      var totalMasuk = (Number(data.cashAmount) || 0) + (Number(data.nonCashAmount) || 0);
      var idTag = data.id ? '[ID:' + data.id + '] ' : '';
      sheet1.appendRow([
        Number(data.uangModal) || 0,
        totalMasuk,
        0,
        Number(data.saldoBersih) || 0,
        Number(data.pendingCount) || 0,
        data.cashierName || '',
        data.date || '',
        'UANG MASUK (CLOSING - ' + (data.shift || 'Pagi') + ')',
        idTag + (data.notes || 'Setoran kasir'),
        totalMasuk
      ]);
    } else if (data.type === 'expense') {
      var amount = Number(data.amount) || 0;
      var idTag = data.id ? '[ID:' + data.id + '] ' : '';
      sheet1.appendRow([
        Number(data.uangModal) || 0,
        0,
        amount,
        Number(data.saldoBersih) || 0,
        Number(data.pendingCount) || 0,
        data.recordedByName || 'Admin',
        data.date || '',
        'PENGELUARAN (' + (data.category || 'Operasional') + ')',
        idTag + (data.title || data.notes || ''),
        amount
      ]);
    } else if (data.type === 'update') {
      var targetId = data.id;
      if (targetId) {
        var rows = sheet1.getDataRange().getValues();
        for (var r = 1; r < rows.length; r++) {
          var desc = String(rows[r][8] || ''); // Col I is index 8
          if (desc.indexOf('[ID:' + targetId + ']') !== -1) {
            var rowNum = r + 1;
            if (data.uangModal !== undefined) sheet1.getRange(rowNum, 1).setValue(Number(data.uangModal) || 0);
            if (data.uangMasuk !== undefined) sheet1.getRange(rowNum, 2).setValue(Number(data.uangMasuk) || 0);
            if (data.uangKeluar !== undefined) sheet1.getRange(rowNum, 3).setValue(Number(data.uangKeluar) || 0);
            if (data.saldoBersih !== undefined) sheet1.getRange(rowNum, 4).setValue(Number(data.saldoBersih) || 0);
            if (data.pendingCount !== undefined) sheet1.getRange(rowNum, 5).setValue(Number(data.pendingCount) || 0);
            if (data.userName !== undefined) sheet1.getRange(rowNum, 6).setValue(data.userName);
            if (data.date !== undefined) sheet1.getRange(rowNum, 7).setValue(data.date);
            if (data.typeCategory !== undefined) sheet1.getRange(rowNum, 8).setValue(data.typeCategory);
            if (data.notes !== undefined) {
              sheet1.getRange(rowNum, 9).setValue('[ID:' + targetId + '] ' + data.notes);
            }
            if (data.amount !== undefined) sheet1.getRange(rowNum, 10).setValue(Number(data.amount) || 0);
            break;
          }
        }
      }
    } else if (data.type === 'delete') {
      var targetId = data.id;
      if (targetId) {
        var rows = sheet1.getDataRange().getValues();
        for (var r = rows.length - 1; r >= 1; r--) {
          var desc = String(rows[r][8] || '');
          if (desc.indexOf('[ID:' + targetId + ']') !== -1) {
            sheet1.deleteRow(r + 1);
          }
        }
      }
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
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Sync Google Sheets berhasil' }))
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
  return ContentService.createTextOutput("Webhook Emong Ramen House Aktif!");
}
`;

export async function sendToGoogleSheetsWebhook(
  webhookUrl: string,
  payload: { type: 'closing' | 'expense' | 'export_all' | 'revoke_user' | 'update' | 'delete' } & Record<string, any>
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

  closings.forEach((c) => {
    const masuk = (c.cashAmount || 0) + (c.nonCashAmount || 0);
    records.push({
      id: c.id,
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

  expenses.forEach((e) => {
    records.push({
      id: e.id,
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

/**
 * Resolves a safe, accessible Google Sheets URL.
 * Automatically cleans whitespace, prepends https:// if missing,
 * and falls back to Google Sheets Home if placeholder or empty.
 */
export function getValidSpreadsheetUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return 'https://docs.google.com/spreadsheets';
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes('your-spreadsheet-id') || trimmed.includes('your-id')) {
    return 'https://docs.google.com/spreadsheets';
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Robust cross-platform launcher for Google Sheets that works reliably
 * in Mobile Standalone PWAs (iOS Safari Add to Home Screen & Android Chrome PWA),
 * WebViews, and desktop browsers without being blocked by popup blockers.
 */
export function openExternalGoogleSheets(url: string, e?: React.MouseEvent): void {
  const targetUrl = getValidSpreadsheetUrl(url);

  // Detect Mobile PWA Standalone Mode (iOS WebClip or Android PWA)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  // In mobile standalone PWA on Android & iOS, invoking window.open synchronously
  // within the active user gesture stack instructs the mobile OS to launch Mobile Safari / Chrome
  // or the native Google Sheets app directly.
  if (isStandalone) {
    try {
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        if (e && typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        return;
      }
    } catch (err) {
      console.warn('[PWA Sheets] Standalone window.open fallback:', err);
    }
  }

  // Fallback for standalone when window.open is restricted or non-anchor click:
  if (!e || (e.currentTarget && (e.currentTarget as HTMLElement).tagName !== 'A')) {
    try {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.href = targetUrl;
    }
  }
}

