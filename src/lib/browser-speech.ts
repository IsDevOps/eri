// Free, key-less speech-to-text using the browser's built-in recognizer (Chrome / Edge / Safari).
// Chrome streams the audio to its vendor for transcription, so it needs internet, and English works best.
// The server-side route (/api/ear/transcribe + OPENAI_API_KEY) remains the option for Hausa / Yorùbá / Igbo.

interface SpeechResultList {
  length: number;
  [i: number]: { isFinal: boolean; [j: number]: { transcript: string } };
}
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognizerCtor = new () => Recognizer;

function ctor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = (): boolean => ctor() !== null;

export const SPEECH_LANGS: { code: string; label: string }[] = [
  { code: "en-NG", label: "English (Nigeria)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-US", label: "English (US)" },
  { code: "ha-NG", label: "Hausa (may not be supported)" },
  { code: "yo-NG", label: "Yorùbá (may not be supported)" },
  { code: "ig-NG", label: "Igbo (may not be supported)" },
];

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone permission was blocked. Allow the microphone for this site and try again.",
  "service-not-allowed": "Speech recognition is blocked in this browser.",
  "audio-capture": "No microphone found.",
  network: "Speech recognition needs an internet connection.",
  "language-not-supported": "This browser can't recognise that language. Pick English, or use the server transcription button.",
};

export interface SpeechHandlers {
  lang: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  /** Called once when listening has really stopped (after stop() or a fatal error). */
  onEnd: () => void;
}

/** Start continuous recognition. Browsers end a session after a pause, so it restarts itself until stop() is called. */
export function startBrowserSpeech(h: SpeechHandlers): { stop: () => void } {
  const Rec = ctor();
  if (!Rec) {
    h.onError("This browser has no speech recognition. Use Chrome or Edge, or paste the transcript.");
    h.onEnd();
    return { stop: () => {} };
  }
  const rec = new Rec();
  rec.lang = h.lang;
  rec.continuous = true;
  rec.interimResults = true;
  let active = true;

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r[0].transcript;
      if (r.isFinal) h.onFinal(text.trim());
      else interim += text;
    }
    h.onInterim(interim);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return; // normal pauses
    active = false;
    h.onError(ERRORS[e.error] ?? `Speech recognition error: ${e.error}`);
  };
  rec.onend = () => {
    if (active) {
      try {
        rec.start();
        return;
      } catch {
        active = false;
      }
    }
    h.onEnd();
  };

  try {
    rec.start();
  } catch {
    active = false;
    h.onError("Could not start the microphone.");
    h.onEnd();
  }
  return {
    stop: () => {
      active = false;
      try {
        rec.stop();
      } catch {
        h.onEnd();
      }
    },
  };
}
