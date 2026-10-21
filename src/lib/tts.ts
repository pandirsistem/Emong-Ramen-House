// Text-to-Speech utility in Indonesian

export function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis is not supported on this device/browser.');
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Find an Indonesian voice if available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('ID'));
      if (idVoice) {
        utterance.voice = idVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.warn('TTS error:', e);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis exception:', err);
      resolve();
    }
  });
}

export function formatRupiahSpoken(num: number): string {
  if (num >= 1000000000) {
    const b = num / 1000000000;
    return `${b % 1 === 0 ? b : b.toFixed(1)} milyar rupiah`;
  }
  if (num >= 1000000) {
    const m = num / 1000000;
    return `${m % 1 === 0 ? m : m.toFixed(1)} juta rupiah`;
  }
  if (num >= 1000) {
    const k = num / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(0)} ribu rupiah`;
  }
  return `${num} rupiah`;
}
