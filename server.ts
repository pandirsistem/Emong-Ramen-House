import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

// Gemini AI Voice parsing endpoint
app.post('/api/parse-voice', async (req, res) => {
  try {
    const { transcript, role } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `
Anda adalah sistem AI parsing transaksi keuangan berbahasa Indonesia untuk aplikasi pembukuan bisnis.
Role pengguna saat ini: "${role}" ("admin" atau "cashier").
Daftar 7 kategori pengeluaran operasional (hanya untuk pengeluaran):
1. "Beli Bahan Baku" (misal: beras, telur, ayam, sayur, minyak, kopi, tepung, bumbu dapur)
2. "Gaji Karyawan Operasional" (misal: gaji staf, barista, upah harian, honor kasir, lembur)
3. "Listrik & Air" (misal: token listrik PLN, bayar PDAM, pulsa listrik, isi galon)
4. "Sewa Tempat" (misal: sewa ruko, sewa kios, lapak jualan, kontrak bulanan)
5. "Gas / Bahan Bakar" (misal: gas elpiji 3kg/12kg, bensin pertalite/pertamax motor operasional, solar, tol)
6. "Beli Peralatan & Perlengkapan" (misal: wajan, blender, kompor, piring, cup plastik, kantong kresek, nota, ATK)
7. "Lain-lain (Operasional)" (misal: uang sampah, iuran RT/keamanan, servis alat, kebersihan)

Instruksi:
- Analisis teks ucapan bahasa Indonesia dan konversi kata bilangan ke angka murni (contoh: "dua juta lima ratus ribu" -> 2500000, "tiga ratus lima puluh ribu" -> 350000, "50rb" -> 50000).
- Jika ucapan mengenai setoran uang masuk / closing kasir ("setoran tunai ... non tunai ...", "closing shift ...", "uang kasir ..."), set type: "closing".
- Jika ucapan mengenai pengeluaran belanja / biaya operasional ("beli ...", "biaya ...", "bayar ..."), set type: "expense".
- Ekstrak JSON murni:
Untuk type="closing":
{
  "type": "closing",
  "cashAmount": number,
  "nonCashAmount": number,
  "expectedPosAmount": number,
  "shift": "Pagi" | "Siang" | "Malam" | "Full-Day",
  "notes": string
}
Untuk type="expense":
{
  "type": "expense",
  "expenseCategory": "Beli Bahan Baku" | "Gaji Karyawan Operasional" | "Listrik & Air" | "Sewa Tempat" | "Gas / Bahan Bakar" | "Beli Peralatan & Perlengkapan" | "Lain-lain (Operasional)",
  "expenseAmount": number,
  "title": string,
  "notes": string
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUcapan Suara Pengguna: "${transcript}"` }] }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    let responseText = response.text || '{}';
    // Clean any markdown wrapper if present
    responseText = responseText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(responseText);
    return res.json(parsed);
  } catch (error) {
    console.error('Gemini Voice parse error:', error);
    return res.status(500).json({ error: 'Failed to parse voice transcript with Gemini' });
  }
});

// Start server with Vite or static
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
