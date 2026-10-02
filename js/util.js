// util.js - small helpers shared by the other files.

// Make text safe to put inside HTML.
export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The picture for a word: photo if there is one, else emoji, else nothing.
export function picHtml(item) {
  if (item.image) return `<img src="${esc(item.image)}" alt="">`;
  if (item.emoji) return esc(item.emoji);
  return '';
}

let toastTimer = 0;
export function toast(message, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// Shows a message box at the bottom of the screen (e.g. "camera is blocked").
export function notice(html) {
  document.getElementById('notice-text').innerHTML = html;
  document.getElementById('notice').hidden = false;
}

// Shrink a photo so it doesn't fill up storage. Returns a JPEG data URL.
export function resizeImage(file, maxSize = 400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo.'));
    };
    img.src = url;
  });
}
