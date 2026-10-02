// speech.js
// ---------------------------------------------------------------------------
// Text-to-speech using the browser's built-in Web Speech API.
// Works offline on iPad with the voices installed on the device.
// More/better voices: iPad Settings > Accessibility > Spoken Content > Voices.
// ---------------------------------------------------------------------------

const synth = window.speechSynthesis;
let settings = { voiceURI: '', rate: 0.9 };
let unlocked = false;

export function configure(newSettings) {
  settings = { ...settings, ...newSettings };
}

export function isSupported() {
  return !!synth;
}

// iPad Safari only allows speech after the person has touched the screen once.
// We call this from the "Tap to start" button.
export function unlock() {
  if (!synth || unlocked) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
  unlocked = true;
}

// Voices load asynchronously; this waits for them (up to ~2 s).
export function getVoices() {
  return new Promise((resolve) => {
    if (!synth) return resolve([]);
    let voices = synth.getVoices();
    if (voices.length) return resolve(voices);
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 2000);
  });
}

export function speak(text) {
  if (!synth || !text) return;
  synth.cancel(); // stop anything still talking so the newest word is heard right away
  const u = new SpeechSynthesisUtterance(text);
  u.rate = settings.rate;
  if (settings.voiceURI) {
    const voice = synth.getVoices().find((v) => v.voiceURI === settings.voiceURI);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
  }
  synth.speak(u);
}
