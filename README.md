# Talk Board

An eye-gaze communication board for iPad. Big word tiles that speak out loud when picked by **touch**, by **looking** (iPad's built-in Eye Tracking), or with **camera eye tracking** built into the app.

Plain HTML, CSS, and JavaScript. No build step, no accounts, no internet needed once installed. Everything stays on the iPad.

---

## Contents

1. [Put it online (GitHub Pages)](#1-put-it-online-github-pages)
2. [Add it to the iPad home screen](#2-add-it-to-the-ipad-home-screen)
3. [Choose how to pick words with the eyes](#3-choose-how-to-pick-words-with-the-eyes)
4. [Using the board](#4-using-the-board)
5. [Caregiver mode](#5-caregiver-mode)
6. [Backups](#6-backups)
7. [Privacy](#7-privacy)
8. [Troubleshooting](#8-troubleshooting)
9. [Changing the code](#9-changing-the-code)

---

## 1. Put it online (GitHub Pages)

The camera only works on a secure (`https://`) address. GitHub Pages provides one for free.

1. On github.com, open this repository.
2. Make sure the app files are on the **main** branch. If they're on another branch, open a pull request and merge it first. (Or pick that branch in step 5.)
3. Click **Settings** (top of the repository page).
4. In the left menu, click **Pages**.
5. Under **Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` and folder `/ (root)`
   - Click **Save**.
6. Wait 1 to 2 minutes, then refresh the page. A box appears at the top: **"Your site is live at …"**. The address will look like:
   `https://bschatte.github.io/Uncle-Bob-s-helper/`
7. Open that address on the iPad in **Safari**.

> GitHub Pages is free for public repositories. A private repository needs a paid GitHub plan for Pages.

## 2. Add it to the iPad home screen

1. Open the address from step 1 in **Safari** (it must be Safari).
2. Tap the **Share** button (square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Leave the name as **Talk Board** and tap **Add**.
5. Open Talk Board from the new icon. It now runs full screen, like a normal app.
6. Open it once while connected to Wi-Fi. After that it works offline.

**Tip:** Home screen apps keep their saved words safely. In a normal Safari tab, Safari may clear saved data if the site isn't used for a few weeks, so always use the home screen icon.

**Tip:** To stop the app being closed by accident, use **Guided Access**: Settings › Accessibility › Guided Access › On. In Talk Board, triple-click the top (or Home) button to start it.

## 3. Choose how to pick words with the eyes

Use **one** of these. Both use the front camera, so they can't run at the same time.

### Option A: iPad's built-in Eye Tracking (recommended first)

Needs iPadOS 18 or later. Usually the most accurate.

1. Settings › Accessibility › **Eye Tracking** › turn on.
2. Follow the dot-calibration on screen.
3. A pointer now follows the eyes. In Talk Board, resting the pointer on a tile fills a ring, then the tile speaks.
4. The iPad has its own **Dwell Control** (it taps for you after a pause). Either is fine:
   - Leave it on: the iPad taps, and Talk Board makes sure a tile is never said twice.
   - Turn it off: Talk Board's own fill ring decides, using the dwell time you set in caregiver mode.

Keep **"Dwell with a pointer"** turned on in caregiver mode › Settings.

### Option B: Talk Board's own camera tracking

Works on older iPads too. Less precise than Option A, but fine for big tiles (4 to 6 per page works best).

1. Open caregiver mode (hold the gear for 2 seconds) › **Settings** › turn on **Camera eye tracking**.
2. Read the explanation and tap **Turn on camera**, then **Allow** when the iPad asks.
3. Calibration starts: position the iPad so the face is in the picture, then tap **Start**. Look at each of the 5 dots until it shrinks.
4. A small red dot shows where the app thinks the eyes are looking. Turn it off in Settings if it's distracting.

Recalibrate (tap the **👁️ Eye tracking on** label at the top right) whenever the iPad or the person moves, or if tiles become hard to pick. Turning the iPad sideways or upright also needs a new calibration.

For the best results: light on the face (not a bright window behind), iPad on a stand at eye level, about an arm's length away.

## 4. Using the board

- **Top banner:** shows the last word said. Tap it to say it again.
- **Group buttons:** Favorites, Needs, Answers, People, Feelings, and **Type**. Look at or tap one to switch.
- **Tiles:** look at a tile until the ring fills (default 1.5 seconds), or tap it.
- **Back / Next:** large tiles on the sides appear when a group has more words than fit.
- **Type:** opens a big keyboard. **Speak** says the sentence. **Recent** shows earlier sentences; tap one to say it again. **Save as tile** adds the sentence to Favorites.

## 5. Caregiver mode

**Press and hold the small ⚙️ gear (top right) for 2 seconds.** A ring fills while you hold. A short tap or a look won't open it, so it can't be opened by accident.

| Tab | What you can do |
|---|---|
| **Words** | Pick a group, then **➕ Add word**. Type the word, optionally a longer sentence to say instead (e.g. tile "Blanket", says "Can I have a blanket please"), choose a group, pick an emoji or **📷 Add photo**. ✏️ edits (including moving to another group), ▲ ▼ reorder, ⭐ copies to Favorites, 🗑 deletes. |
| **Groups** | Add, rename, recolor, reorder, or delete groups. Favorites can't be deleted. Keep to about 6 groups so buttons stay big. |
| **Settings** | Dwell time (0.5 to 4 s), tiles per page (4 to 9), text size, voice, speech speed, camera tracking, theme (light/dark), keyboard layout (QWERTY or A B C). |
| **Backup** | Export, import, and **Reset to defaults** (asks first). |

Tap **Done** to go back to the board. Changes save automatically.

**Ideas:** rename "Wife" and "Kids" to real names and add their photos. Photos of real people and objects are often easier to recognise than emoji.

**Better voices:** iPad Settings › Accessibility › Spoken Content › Voices. Download an "Enhanced" or "Premium" voice, then choose it in Talk Board › Settings › Voice.

## 6. Backups

All words, photos, and settings are stored on the iPad only. Make a backup after big changes:

- Caregiver mode › **Backup** › **Export backup** › choose **Save to Files** (or AirDrop / Mail).
- To restore (or copy to a new iPad): **Import backup** › pick the file.

## 7. Privacy

- Camera video is processed **on the iPad only**. It is never recorded, saved, or uploaded.
- The eye-tracking software (Google's open-source MediaPipe) is stored inside this app in `vendor/mediapipe/`, so it doesn't contact any outside server.
- No accounts, ads, or analytics. Nothing is sent anywhere.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| No sound | Turn up the volume. Check the iPad isn't in Silent mode. Tap the banner to try again. |
| "Camera blocked" | iPad Settings › Apps › Safari › Camera › **Allow** (older iPads: Settings › Safari › Camera). Then close Talk Board fully (swipe it away) and reopen. The board still works by touch meanwhile. |
| "Can't see face" | Better light on the face, move the iPad so the face is centered, or bring it a little closer. |
| Gaze lands on the wrong tile | Recalibrate. Use fewer tiles per page (4 or 6). Increase dwell time. |
| Picks happen too fast or too slow | Caregiver mode › Settings › Dwell time. |
| Old version still showing after an update | Close and reopen the app twice. |
| "Could not save. Storage may be full." | Too many large photos. Remove some, and export a backup. |

## 9. Changing the code

Every file is commented. Edit on github.com (open a file, click the ✏️ pencil) and GitHub Pages republishes in about a minute.

| File | What it does |
|---|---|
| `index.html` | Page layout: board, type screen, caregiver mode, dialogs. |
| `css/app.css` | All colors, sizes, light/dark theme. Colors are variables at the top. |
| `js/storage.js` | **Starting words and default settings**, saving, backup files. |
| `js/board.js` | Draws tiles and group buttons; grid shapes for 4 to 9 tiles. |
| `js/dwell.js` | The fill ring and "look to pick" timing. |
| `js/gaze.js` | Camera eye tracking and the 5-dot calibration. Tuning values are near the top (`SMOOTHING`, `GRACE_MS`, …). |
| `js/keyboard.js` | Type-to-speak screen and keyboard layouts. |
| `js/editor.js` | Caregiver mode. Quick-pick emoji list is at the top. |
| `js/speech.js` | Speaking out loud. |
| `js/app.js` | Starts everything and connects the pieces. |
| `sw.js` | Offline support. **After changing any file, bump `CACHE_VERSION`** (e.g. `'v1'` → `'v2'`) so iPads pick up the new version. |
| `manifest.webmanifest`, `icons/` | Home screen name and icon. |
| `vendor/mediapipe/` | Eye-tracking library and face model (don't edit). |

**Changing the starting words:** edit `DEFAULT_WORDS` in `js/storage.js`. The iPad only picks them up after caregiver mode › Backup › Reset to defaults (saved words always win over defaults).

**Try it on a computer:** run any static web server in this folder, for example `npx http-server -c-1 .`, then open `http://localhost:8080`. (Camera access works on `localhost` and on `https://` addresses only.)

### How it was tested

Tested with automated browser tests (Chromium) at iPad Air, iPad mini, iPad 10th gen, and iPad Pro 13" sizes, in both orientations: layout fits without scrolling, tap and pointer dwell, paging, caregiver mode (add, edit, move, reorder, delete), settings, typing, backup export/import/reset, offline reload, camera blocked message, and camera gaze tracking with a test face image. Safari itself couldn't be run in the test environment, so do a final check on the real iPad: speech, camera permission, home screen install, and iPad Eye Tracking.
