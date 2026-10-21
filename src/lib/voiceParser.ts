import { ExpenseCategory, EXPENSE_CATEGORIES, ShiftType, VoiceParsedData } from '../types';

// Map spoken words to standard numbers in Indonesian
export function parseIndonesianNumber(text: string): number {
  if (!text) return 0;
  let clean = text.toLowerCase()
    .replace(/rp\.?/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim();

  // Direct numeric matches like "2000000" or "500000"
  const directNum = clean.match(/\b\d+(\.\d+)?\b/);

  // Check multipliers in string like "2.5 juta", "500 ribu", "150k"
  const matchK = clean.match(/(\d+(?:\.\d+)?)\s*(k|rb|ribu)\b/i);
  if (matchK) {
    return Math.round(parseFloat(matchK[1]) * 1000);
  }

  const matchJt = clean.match(/(\d+(?:\.\d+)?)\s*(jt|juta)\b/i);
  if (matchJt) {
    return Math.round(parseFloat(matchJt[1]) * 1000000);
  }

  const matchM = clean.match(/(\d+(?:\.\d+)?)\s*(m|milyar|miliar)\b/i);
  if (matchM) {
    return Math.round(parseFloat(matchM[1]) * 1000000000);
  }

  // Indonesian word numerals mapping
  const wordMap: Record<string, number> = {
    nol: 0,
    setengah: 0.5,
    satu: 1,
    se: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
    tujuh: 7,
    delapan: 8,
    sembilan: 9,
    sepuluh: 10,
    sebelas: 11,
    belas: 10,
    puluh: 10,
    seratus: 100,
    ratus: 100,
    seribu: 1000,
    ribu: 1000,
    sejuta: 1000000,
    juta: 1000000,
    miliar: 1000000000,
    milyar: 1000000000,
  };

  // Convert phrases like "dua juta lima ratus ribu"
  const words = clean.split(/[\s-]+/);
  let total = 0;
  let current = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (/^\d+$/.test(w)) {
      current += parseInt(w, 10);
      continue;
    }

    if (w === 'sejuta') {
      current = 1000000;
      total += current;
      current = 0;
      continue;
    }
    if (w === 'seribu') {
      current = 1000;
      total += current;
      current = 0;
      continue;
    }
    if (w === 'seratus') {
      current += 100;
      continue;
    }
    if (w === 'sepuluh') {
      current += 10;
      continue;
    }
    if (w === 'sebelas') {
      current += 11;
      continue;
    }

    if (w === 'belas') {
      current += 10;
      continue;
    }
    if (w === 'puluh') {
      current = (current === 0 ? 1 : current) * 10;
      continue;
    }
    if (w === 'ratus') {
      current = (current === 0 ? 1 : current) * 100;
      continue;
    }
    if (w === 'ribu') {
      current = (current === 0 ? 1 : current) * 1000;
      total += current;
      current = 0;
      continue;
    }
    if (w === 'juta') {
      current = (current === 0 ? 1 : current) * 1000000;
      total += current;
      current = 0;
      continue;
    }

    if (wordMap[w] !== undefined) {
      current += wordMap[w];
    }
  }

  total += current;
  if (total > 0) return total;

  if (directNum) {
    return parseFloat(directNum[0]);
  }

  return 0;
}

// Map Indonesian natural keywords to 7 specific categories
export function mapKeywordsToCategory(text: string): ExpenseCategory {
  const t = text.toLowerCase();

  // Beli Bahan Baku
  if (
    /bahan|baku|beras|telur|telor|ayam|daging|sayur|cabe|cabai|bawang|minyak|tepung|kopi|teh|susu|keju|gula|garam|kecap|saus|bumbu|roti|mie|mie instan|keperluan dapur/i.test(t)
  ) {
    return 'Beli Bahan Baku';
  }

  // Gaji Karyawan Operasional
  if (
    /gaji|upah|honor|lembur|kasir|barista|karyawan|pegawai|staf|koki|waiter|bonus|tunjangan/i.test(t)
  ) {
    return 'Gaji Karyawan Operasional';
  }

  // Listrik & Air
  if (
    /listrik|pln|token|pulsa listrik|air|pdam|pam|galon|isi ulang air/i.test(t)
  ) {
    return 'Listrik & Air';
  }

  // Sewa Tempat
  if (
    /sewa|kontrak|ruko|kios|lapak|outlet|gedung|sewa tempat/i.test(t)
  ) {
    return 'Sewa Tempat';
  }

  // Gas / Bahan Bakar
  if (
    /gas|elpiji|lpg|bensin|pertalite|pertamax|solar|bbm|ongkir|bensin motor|bensin mobil|tol|parkir/i.test(t)
  ) {
    return 'Gas / Bahan Bakar';
  }

  // Beli Peralatan & Perlengkapan
  if (
    /peralatan|perlengkapan|wajan|kompor|piring|gelas|blender|pisau|sendok|garpu|atk|kertas|plastik|cup|kresek|kantong|sedotan|tisu|meja|kursi/i.test(t)
  ) {
    return 'Beli Peralatan & Perlengkapan';
  }

  // Default to Lain-lain
  return 'Lain-lain (Operasional)';
}

// Local Fallback Parser using NLP rules
export function parseVoiceInputLocal(transcript: string, defaultRole: 'admin' | 'cashier'): VoiceParsedData {
  const clean = transcript.trim();
  const lower = clean.toLowerCase();

  const isClosing =
    defaultRole === 'cashier' ||
    /closing|setoran|uang masuk|shift|tunai|non tunai|qris|edc/i.test(lower);

  if (isClosing) {
    // Detect Shift
    let shift: ShiftType = 'Pagi';
    if (/siang/i.test(lower)) shift = 'Siang';
    else if (/malam/i.test(lower)) shift = 'Malam';
    else if (/full|seharian/i.test(lower)) shift = 'Full-Day';

    // Parse Tunai and Non-Tunai separately
    let cashAmount = 0;
    let nonCashAmount = 0;

    // Pattern: "tunai 2 juta non tunai 500 ribu" or "tunai: 2jt, non tunai: 500rb"
    const cashRegex = /tunai\s+(?:sebesar\s+)?([a-z0-9\s.,]+?)(?=(?:non\s*tunai|qris|transfer|edc|shift|$))/i;
    const nonCashRegex = /(?:non\s*tunai|qris|transfer|edc)\s+(?:sebesar\s+)?([a-z0-9\s.,]+?)(?=(?:tunai|shift|$))/i;

    const cashMatch = lower.match(cashRegex);
    const nonCashMatch = lower.match(nonCashRegex);

    if (cashMatch) {
      cashAmount = parseIndonesianNumber(cashMatch[1]);
    }
    if (nonCashMatch) {
      nonCashAmount = parseIndonesianNumber(nonCashMatch[1]);
    }

    // If neither matched specifically, try overall number
    if (cashAmount === 0 && nonCashAmount === 0) {
      const generalNum = parseIndonesianNumber(lower);
      if (generalNum > 0) {
        cashAmount = generalNum;
      }
    }

    return {
      type: 'closing',
      cashAmount,
      nonCashAmount,
      expectedPosAmount: cashAmount + nonCashAmount, // default matched unless stated
      shift,
      rawTranscript: transcript,
      notes: `Input Suara: "${transcript}"`,
    };
  } else {
    // Admin expense parsing
    const category = mapKeywordsToCategory(transcript);
    const amount = parseIndonesianNumber(transcript);

    // Extract title (clean words like "beli", "biaya", numbers, etc.)
    let title = clean
      .replace(/^(catat\s+)?(pengeluaran\s+)?(beli\s+|biaya\s+|bayar\s+)?/i, '')
      .replace(/(sebesar|seharga|senilai)\s+[a-z0-9\s.,]+/i, '')
      .trim();

    if (!title || title.length < 3) {
      title = `${category}`;
    } else {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    return {
      type: 'expense',
      expenseCategory: category,
      expenseAmount: amount,
      title,
      notes: `Input Suara AI: "${transcript}"`,
      rawTranscript: transcript,
    };
  }
}

// Call Server AI API or fallback to local
export async function parseVoiceTranscript(
  transcript: string,
  role: 'admin' | 'cashier'
): Promise<VoiceParsedData> {
  try {
    const res = await fetch('/api/parse-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, role }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.cashAmount !== undefined || data.expenseAmount !== undefined)) {
        return {
          ...data,
          rawTranscript: transcript,
        };
      }
    }
  } catch {
    // Server route unavailable, fallback gracefully to NLP local parser
  }

  return parseVoiceInputLocal(transcript, role);
}
