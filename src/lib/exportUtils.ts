import * as XLSX from 'xlsx';
import { ClosingRecord, ExpenseRecord, ExpenseCategory } from '../types';

interface ExportOptions {
  businessName?: string;
  dateRangeLabel: string;
  typeFilter?: 'all' | 'closings' | 'expenses';
}

const CURRENCY_FMT = '"Rp "#,##0;[Red]"-Rp "#,##0;"Rp "0';

/**
 * Creates and downloads a professional multi-sheet Excel (.xlsx) financial report.
 * Adheres strictly to Indonesian accounting standards:
 * - Proper numeric currency cells formatted with "Rp" prefix and thousands dots.
 * - Dates cleanly formatted as YYYY-MM-DD.
 * - Excel SUM formulas and auto-calculated Net Cash Flow.
 * - Multiple dedicated sheets for Summary, Cashier Income, and Business Expenses.
 */
export function exportTransactionsToXLSX(
  closings: ClosingRecord[],
  expenses: ExpenseRecord[],
  options: ExportOptions
) {
  const { businessName = 'EMONG RAMEN HOUSE', dateRangeLabel, typeFilter = 'all' } = options;

  const wb = XLSX.utils.book_new();

  const approvedClosings = closings.filter((c) => c.status === 'approved');
  const pendingClosings = closings.filter((c) => c.status === 'pending');
  const rejectedClosings = closings.filter((c) => c.status === 'rejected');

  const totalMasukApproved = approvedClosings.reduce(
    (sum, c) => sum + (c.cashAmount || 0) + (c.nonCashAmount || 0),
    0
  );
  const totalMasukPending = pendingClosings.reduce(
    (sum, c) => sum + (c.cashAmount || 0) + (c.nonCashAmount || 0),
    0
  );
  const totalPengeluaran = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netCashFlow = totalMasukApproved - totalPengeluaran;

  // ==========================================
  // SHEET 1: RINGKASAN & ARUS KAS (Dashboard)
  // ==========================================
  if (typeFilter === 'all') {
    const summaryData: (string | number | { v: number; t: string; z: string } | null)[][] = [
      [`LAPORAN KEUANGAN & ARUS KAS - ${businessName.toUpperCase()}`],
      [`Periode Data: ${dateRangeLabel}`],
      [`Tanggal Unduh: ${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('id-ID')}`],
      [],
      ['1. IKHTISAR UTAMA ARUS KAS (NET CASH FLOW)'],
      ['Indikator Keuangan', 'Nilai Nominal', 'Catatan Status'],
      [
        'Total Uang Masuk Kasir (Disetujui / Valid)',
        { v: totalMasukApproved, t: 'n', z: CURRENCY_FMT },
        `${approvedClosings.length} setoran shift divalidasi fisik`
      ],
      [
        'Total Beban Pengeluaran Bisnis (Admin)',
        { v: totalPengeluaran, t: 'n', z: CURRENCY_FMT },
        `${expenses.length} transaksi operasional & belanja stok`
      ],
      [
        'Saldo Kas Bersih (Net Cash Flow)',
        { v: netCashFlow, t: 'n', z: CURRENCY_FMT },
        netCashFlow >= 0 ? 'Surplus (Laba Bersih Operasional)' : 'Defisit (Pengeluaran Melebihi Masuk)'
      ],
      [
        'Total Setoran Kasir Pending (Menunggu Validasi)',
        { v: totalMasukPending, t: 'n', z: CURRENCY_FMT },
        `${pendingClosings.length} setoran shift menunggu dicek`
      ],
      [],
      ['2. RINCIAN PENGELUARAN BERDASARKAN KATEGORI'],
      ['Kategori Pengeluaran', 'Total Biaya', '% dari Pengeluaran']
    ];

    // Compute category breakdown
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0);
    });

    Object.entries(categoryTotals).forEach(([cat, amount]) => {
      const percentage = totalPengeluaran > 0 ? ((amount / totalPengeluaran) * 100).toFixed(1) + '%' : '0%';
      summaryData.push([
        cat,
        { v: amount, t: 'n', z: CURRENCY_FMT },
        percentage
      ]);
    });

    summaryData.push([]);
    summaryData.push(['3. REKAPITULASI PENJUALAN PER SHIFT KASIR']);
    summaryData.push(['Shift Kerja', 'Jumlah Transaksi', 'Uang Fisik Tunai', 'Non-Tunai (QRIS/EDC)', 'Total Setoran']);

    const shifts: ('Pagi' | 'Siang' | 'Malam' | 'Full-Day')[] = ['Pagi', 'Siang', 'Malam', 'Full-Day'];
    shifts.forEach((s) => {
      const shiftClosings = closings.filter((c) => c.shift === s);
      const shiftCash = shiftClosings.reduce((sum, c) => sum + (c.cashAmount || 0), 0);
      const shiftNonCash = shiftClosings.reduce((sum, c) => sum + (c.nonCashAmount || 0), 0);
      const shiftTotal = shiftCash + shiftNonCash;
      summaryData.push([
        `Shift ${s}`,
        shiftClosings.length,
        { v: shiftCash, t: 'n', z: CURRENCY_FMT },
        { v: shiftNonCash, t: 'n', z: CURRENCY_FMT },
        { v: shiftTotal, t: 'n', z: CURRENCY_FMT }
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [
      { wch: 45 },
      { wch: 25 },
      { wch: 40 },
      { wch: 25 },
      { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan & Arus Kas');
  }

  // ==========================================
  // SHEET 2: UANG MASUK (KASIR)
  // ==========================================
  if (typeFilter === 'all' || typeFilter === 'closings') {
    const cashierRows: (string | number | { v: number; t: string; z: string } | null)[][] = [
      [`DATA PENERIMAAN & SETORAN KASIR - ${businessName.toUpperCase()}`],
      [`Periode: ${dateRangeLabel}`],
      [`Total Data: ${closings.length} Transaksi Shift Kasir`],
      [],
      [
        'No',
        'Tanggal (YYYY-MM-DD)',
        'Shift',
        'Nama Kasir',
        'Uang Fisik Tunai',
        'Non-Tunai (QRIS/EDC)',
        'Total Masuk',
        'Target POS Mesin',
        'Selisih POS',
        'Alasan Selisih',
        'Status Validasi',
        'Catatan'
      ]
    ];

    let rowIdx = 1;
    closings.forEach((c) => {
      const totalMasuk = (c.cashAmount || 0) + (c.nonCashAmount || 0);
      cashierRows.push([
        rowIdx++,
        c.date, // Formatted strictly as YYYY-MM-DD
        `Shift ${c.shift}`,
        c.cashierName,
        { v: c.cashAmount || 0, t: 'n', z: CURRENCY_FMT },
        { v: c.nonCashAmount || 0, t: 'n', z: CURRENCY_FMT },
        { v: totalMasuk, t: 'n', z: CURRENCY_FMT },
        { v: c.expectedPosAmount || 0, t: 'n', z: CURRENCY_FMT },
        { v: c.discrepancyAmount || 0, t: 'n', z: CURRENCY_FMT },
        c.discrepancyReason || '-',
        c.status === 'approved' ? 'Approved (Disetujui)' : c.status === 'rejected' ? 'Rejected (Ditolak)' : 'Pending Validasi',
        c.notes || '-'
      ]);
    });

    // Add Total Summary row at bottom
    if (closings.length > 0) {
      const sumCash = closings.reduce((sum, c) => sum + (c.cashAmount || 0), 0);
      const sumNonCash = closings.reduce((sum, c) => sum + (c.nonCashAmount || 0), 0);
      const sumTotal = sumCash + sumNonCash;
      const sumPos = closings.reduce((sum, c) => sum + (c.expectedPosAmount || 0), 0);
      const sumDisc = closings.reduce((sum, c) => sum + (c.discrepancyAmount || 0), 0);

      cashierRows.push([]);
      cashierRows.push([
        'TOTAL KESELURUHAN',
        '',
        '',
        '',
        { v: sumCash, t: 'n', z: CURRENCY_FMT },
        { v: sumNonCash, t: 'n', z: CURRENCY_FMT },
        { v: sumTotal, t: 'n', z: CURRENCY_FMT },
        { v: sumPos, t: 'n', z: CURRENCY_FMT },
        { v: sumDisc, t: 'n', z: CURRENCY_FMT },
        '',
        '',
        ''
      ]);
    }

    const wsCashier = XLSX.utils.aoa_to_sheet(cashierRows);
    wsCashier['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 14 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 30 },
      { wch: 20 },
      { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCashier, 'Uang Masuk (Kasir)');
  }

  // ==========================================
  // SHEET 3: PENGELUARAN (ADMIN)
  // ==========================================
  if (typeFilter === 'all' || typeFilter === 'expenses') {
    const expenseRows: (string | number | { v: number; t: string; z: string } | null)[][] = [
      [`DATA BEBAN PENGELUARAN BISNIS - ${businessName.toUpperCase()}`],
      [`Periode: ${dateRangeLabel}`],
      [`Total Data: ${expenses.length} Transaksi Beban Operasional`],
      [],
      [
        'No',
        'Tanggal (YYYY-MM-DD)',
        'Kategori Pengeluaran',
        'Keterangan / Uraian Biaya',
        'Jumlah Pengeluaran (Rp)',
        'Dicatat Oleh',
        'Catatan Tambahan'
      ]
    ];

    let expIdx = 1;
    expenses.forEach((e) => {
      expenseRows.push([
        expIdx++,
        e.date, // Formatted strictly as YYYY-MM-DD
        e.category,
        e.title,
        { v: e.amount || 0, t: 'n', z: CURRENCY_FMT },
        e.recordedByName || 'Admin',
        e.notes || '-'
      ]);
    });

    // Add Total Summary row at bottom
    if (expenses.length > 0) {
      const sumExpenseTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      expenseRows.push([]);
      expenseRows.push([
        'TOTAL PENGELUARAN',
        '',
        '',
        '',
        { v: sumExpenseTotal, t: 'n', z: CURRENCY_FMT },
        '',
        ''
      ]);
    }

    const wsExpense = XLSX.utils.aoa_to_sheet(expenseRows);
    wsExpense['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 28 },
      { wch: 35 },
      { wch: 24 },
      { wch: 20 },
      { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsExpense, 'Pengeluaran (Admin)');
  }

  // Generate and download XLSX
  const cleanBusinessName = businessName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanRange = dateRangeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Laporan_Keuangan_${cleanBusinessName}_${cleanRange}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Fallback CSV export function with UTF-8 BOM.
 */
export function exportTransactionsToCSV(
  closings: ClosingRecord[],
  expenses: ExpenseRecord[],
  options: ExportOptions
) {
  const { businessName = 'EMONG RAMEN HOUSE', dateRangeLabel, typeFilter = 'all' } = options;

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[][] = [];

  // Metadata Header Block
  rows.push([`LAPORAN KEUANGAN & PEMBUKUAN BISNIS - ${businessName.toUpperCase()}`]);
  rows.push([`Periode Laporan: ${dateRangeLabel}`]);
  rows.push([`Waktu Unduh: ${new Date().toLocaleString('id-ID')}`]);
  rows.push([
    `Filter Data: ${
      typeFilter === 'all'
        ? 'Semua Transaksi (Pemasukan & Pengeluaran)'
        : typeFilter === 'closings'
        ? 'Khusus Setoran Kasir'
        : 'Khusus Pengeluaran Bisnis'
    }`
  ]);
  rows.push([]);

  // Table Column Headers
  rows.push([
    'No',
    'Tanggal (YYYY-MM-DD)',
    'Tipe Transaksi',
    'Kategori / Shift',
    'Keterangan / Nama Item',
    'Fisik Tunai (Rp)',
    'Non-Tunai QRIS/EDC (Rp)',
    'Total Masuk (Rp)',
    'Target POS (Rp)',
    'Selisih POS (Rp)',
    'Alasan Selisih',
    'Pengeluaran (Rp)',
    'Status Validasi',
    'Petugas / Kasir',
    'Catatan'
  ]);

  let rowNumber = 1;
  let sumMasuk = 0;
  let sumKeluar = 0;

  // Process Closings (Uang Masuk)
  if (typeFilter === 'all' || typeFilter === 'closings') {
    closings.forEach((c) => {
      const totalMasuk = (c.cashAmount || 0) + (c.nonCashAmount || 0);
      if (c.status === 'approved') {
        sumMasuk += totalMasuk;
      }

      rows.push([
        String(rowNumber++),
        c.date,
        'Uang Masuk / Closing',
        `Shift ${c.shift}`,
        `Closing Kasir: ${c.cashierName}`,
        String(c.cashAmount || 0),
        String(c.nonCashAmount || 0),
        String(totalMasuk),
        String(c.expectedPosAmount || 0),
        String(c.discrepancyAmount || 0),
        c.discrepancyReason || '-',
        '0',
        c.status === 'approved'
          ? 'Approved (Disetujui)'
          : c.status === 'rejected'
          ? 'Rejected (Ditolak)'
          : 'Pending Validasi',
        c.cashierName,
        c.notes || '-'
      ]);
    });
  }

  // Process Expenses (Pengeluaran Operasional)
  if (typeFilter === 'all' || typeFilter === 'expenses') {
    expenses.forEach((e) => {
      sumKeluar += e.amount || 0;

      rows.push([
        String(rowNumber++),
        e.date,
        'Pengeluaran Operasional',
        e.category,
        e.title,
        '0',
        '0',
        '0',
        '0',
        '0',
        '-',
        String(e.amount || 0),
        'Tercatat di Sistem',
        e.recordedByName || 'Admin',
        e.notes || '-'
      ]);
    });
  }

  // Summary Footer Block
  rows.push([]);
  rows.push(['=== RINGKASAN TOTAL KEUANGAN PERIODE INI ===']);
  rows.push(['Total Pemasukan Kasir (Disetujui):', '', '', '', '', '', '', String(sumMasuk)]);
  rows.push(['Total Beban Pengeluaran Operasional:', '', '', '', '', '', '', '', '', '', '', String(sumKeluar)]);
  rows.push(['Saldo Kas Bersih (Laba / Rugi):', '', '', '', '', '', '', String(sumMasuk - sumKeluar)]);

  // Format into CSV string with UTF-8 BOM
  const csvBody = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
  const csvContent = '\uFEFF' + csvBody;

  // Trigger browser download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  const cleanBusinessName = businessName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanRange = dateRangeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];

  link.setAttribute('download', `Laporan_${cleanBusinessName}_${cleanRange}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
