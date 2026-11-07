// Short synthesized sounds (no audio files). iOS only plays Web Audio from a context resumed inside a tap, so the tap
// that can lead to a sound calls unlockSound() first; the sound itself may play later (after async work).
// On/off is a per-device choice in localStorage, on by default; storage may be blocked, so every access is guarded.
const KEY = 'sound';
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Not stored: applies until the app is closed.
  }
}

export function unlockSound(): void {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    ctx.resume().catch(() => undefined);
  } catch {
    ctx = null; // no Web Audio: stay silent
  }
}

// A rising four-note arpeggio with a bright top note: the level-up / rank-up moment.
export function playLevelUp(): void {
  if (!soundOn() || !ctx) return;
  ctx.resume().catch(() => undefined); // iOS suspends it after the app was in the background
  const t0 = ctx.currentTime + 0.05;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const at = t0 + i * 0.11;
    const long = i === notes.length - 1;
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = long ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(f, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(long ? 0.12 : 0.2, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (long ? 0.7 : 0.18));
    osc.connect(gain).connect(ctx!.destination);
    osc.start(at);
    osc.stop(at + (long ? 0.75 : 0.2));
  });
}
