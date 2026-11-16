# Bilingual Projector

A free, open-source projector for church services in Telugu and English: the Bible, songs pasted in any format, pictures, a stage screen for the pastor and a livestream overlay for OBS. For Windows and Linux.

**Download:** https://venu-webdev.github.io/bilingual-projector/
(or the files directly from the [latest release](https://github.com/venu-webdev/bilingual-projector/releases/latest))

| System | File |
|---|---|
| Windows 10 / 11 | `Bilingual-Projector-Setup-x64.exe` (installer) or `Bilingual-Projector-Portable-x64.exe` |
| Linux, most distributions | `Bilingual-Projector-x86_64.AppImage`: make it executable (`chmod +x`), then run it |
| Ubuntu, Debian, Mint | `Bilingual-Projector-amd64.deb`: `sudo apt install ./Bilingual-Projector-amd64.deb` |

## Install on Windows 10 / 11

- `Bilingual-Projector-Setup-x64.exe` installs the app with Start menu and desktop shortcuts, and lets you choose the folder.
- `Bilingual-Projector-Portable-x64.exe` runs without installing (from a USB stick, for example).

The files are not code-signed, so the first time Windows SmartScreen may say "Windows protected your PC": choose *More info*, then *Run anyway*. Songs, pictures and settings live in `%APPDATA%\Bilingual Projector`, so reinstalling or updating never loses them.

## Run it from a clone

Needs [Node.js](https://nodejs.org) 18 or newer and Git, on Windows 10 or 11.

```
git clone https://github.com/venu-webdev/bilingual-projector.git
cd bilingual-projector
npm install        # about 2 minutes: downloads Electron
npm start          # builds and opens the app
```

Other commands:

```
npm run dev        # development, with hot reload
npm run dist       # Windows installer and portable .exe in release/
npm test           # the lyrics parser tests
npm run bible -- <telugu.xml>   # rebuild public/bible.json (English from data/kjv.csv)
```

The Bible (`public/bible.json`, Telugu BSI and KJV) is in the repository, so a fresh clone runs as it is.

## Using it

- **Search** (`/` or `Ctrl F`): a reference (`jn 3 16`, `ps 23`, `1 jn 4:8`, `యోహాను 3 16`), a word in either language (`grace`, `కృప`), or a book name. `Enter` opens the chapter at that verse; `Ctrl Enter` also puts it on screen.
- **Click a slide** to put it on screen. `Space`, `→` or a clicker's Page Down shows the next one; `←` goes back. Type `16` then `Enter` to jump to verse 16.
- **On screen / Next**: the right column shows exactly what the room sees and what comes next, drawn by the same code as the projector.
- **Black screen** `B`, **Hide text** `C` (keeps the background), **Bring back** `R`. Always visible.
- **Phone remote** (Output panel, *Phone*): switch it on and scan the QR code with a phone on the same Wi-Fi. The phone shows the screen as the room sees it, with Next, Previous, Black, Hide text, Bring back and the open item's slides to tap. Anyone on the network can open the page and watch; changing the screen needs the 6-digit PIN shown in the app (the QR code carries it, after the `#`, so it never reaches the network). A new PIN is made every time the remote is switched on, five wrong PINs lock that device out for a minute, and *Off* ends it at once. The address list puts the computer's real network first and marks VPNs (Cloudflare WARP, Tailscale) and virtual networks, which other devices cannot reach.
- **History**: double-click a verse (in the slides or the search results) to keep it in *History*, beside the service order, with the time. Name each one (✎) so you remember what it was for, add it to the service order (+), or click it to show it again. History is saved.
- **Service order**: open a passage or song, press *Add to order*, drag to reorder. Several orders can be kept.
- **Songs, pasted from anywhere**: copy lyrics from a website, WhatsApp, Word or the old app, then press `Ctrl V` anywhere outside a text box (or *Paste a song* in Songs). The slides appear straight away. `Ctrl Enter` saves the song and puts it on screen. The parser (`src/lib/lyrics.js`, tests in `tests/`):
  - starts a new slide at an empty line, a number (`1.` `2)`) or a heading (`Chorus`, `పల్లవి`, `చరణం 1`, `[Bridge]`)
  - repeats the chorus where `||పల్లవి||` closes a verse, labelled "Chorus again"
  - puts English or transliteration lines under the Telugu, whether they come line by line or as a separate stanza
  - drops chord lines, `[G]` chords, links and credit lines, and takes the title and writer from them
  - can hide repeat marks like `(2)`, and cuts a song with no empty lines into four-line slides

  The lyrics are kept as pasted, so editing a line later is just editing text.
- **Looks**: nine ready-made looks (Midnight, Pure black, Sanctuary, Evergreen, Bold worship, Daylight, Scripture card, Lower third, Green screen), each with a Bible version and a song version. *Same look for songs and Bible* keeps the background, fonts and colours matched while sizes, languages and the reference stay separate. *Adjust in detail* opens every setting: colour, gradient, picture or video background, middle or lower-third placement, fonts, sizes, reference.
- **Long verses**: a verse that would have to shrink below the *Smallest text* setting (85% by default) continues on a new slide (14a, 14b ...). It is measured in the real font, not estimated, and breaks at a sentence or a comma. Telugu and English split together. A part that stops mid-sentence ends with "…", and dots by the reference show the room there is more. *Steady size* gives every slide of a passage the same text size, so it does not jump between verses. Song stanzas split the same way, between lines.
- **Animations**: each look sets how the words arrive: Fade, Rise, Zoom, Blur in, Cascade (Telugu, then English, then the reference) or None, at Fast, Normal or Slow. The Look tab plays each one on a live preview.
- **Livestream overlay (OBS)**: a separate output for the stream, independent of the room's projector. The app serves a see-through page on this computer only; in OBS add a Browser Source with the address from *Stream (OBS)* (normally `http://127.0.0.1:7357/overlay.html`), 1920 × 1080, above the camera. For Bible slides the stream can show a reference card in a corner, the verse in a lower third, the full slide, or nothing; for songs, the lyrics in a lower third, the song title, the full slide, or nothing. `O` shows or hides it without touching the room's screen. *Hide after* takes the card down 8, 15 or 30 seconds after each change, and it hides when the room's screen goes black.
- **OBS on another computer**: in *Stream (OBS)*, *Share on network* opens a read-only listener on port 7358 and lists this computer's network addresses. Each address has two pages for an OBS Browser Source (1920 × 1080): *Overlay* (`/overlay.html`, see-through, over the camera) and *Full screen* (`/overlay.html?screen`, the projector output itself, including pictures and black). Other computers can only view; requests to change anything are refused, and only the app's pages and media are served. The setting is remembered across restarts, and *Off* closes the listener at once. The first time, Windows may ask to allow network access: choose Private networks.
- **Pictures**: the *Pictures* tab keeps named sets of pictures. Add them by copying a picture anywhere and pressing `Ctrl V`, by dragging files onto the app, with *Add files…*, or with *Find pictures*. That searches Wikimedia Commons for openly licensed photographs, suggests words from the verse being read (Psalm 23 gives shepherd, pastures, waters), and keeps each photograph's author and licence. A set opens as a grid: click picks a picture as Next, double-click or `Space` shows it, `Space` again moves through the set, drag to reorder. Each picture has its own adjustments, which reach the screen live: fill screen, whole picture (with a soft blurred fill or black around it), stretch or actual size (a tall picture starts as whole picture); zoom; move by dragging the preview or with sliders (with fill screen, moving pans across the parts the screen crops, so the top or bottom of a tall picture comes into view, never a black edge); scroll to zoom; rotate, 90° turns, flips; brightness, contrast, colour, hue, blur, black and white, darken. Picture sets go in the service order like songs. The stream shows pictures full screen or not at all, and the stage screen shows the picture.
- **Screens plugged in during a service**: the screen list updates when an HDMI cable goes in or out, with a message saying so. If the projector's or the stage's screen is unplugged, its window closes (it does not jump onto the laptop screen), and when the same screen is plugged back in, it reopens there by itself.
- **Stage screen** (Output panel, *Stage*): a separate window on a monitor at the front. The Stage tab shows a live preview of it, and *Stage text size* (60% to 160%) sets how large the pastor's words are. *Stage shows* picks the *Pastor view* (below) or *Same as projector*, the full slide exactly as the room and the OBS full-screen page see it. The pastor view shows the words on screen large in both languages, "Part 1 of 2, continues", what comes next, the clock and the time since projection started, and a warning when the room's screen is black. Messages typed there ("5 minutes", "Wrap up") appear only on the stage.
- **Moving from the old app**: ⋯ menu, *Import a backup*, and pick a backup exported from Bilingual Projector Pro (or its `projectorSettings.json`). Songs, service orders and both looks come across; background pictures and videos need choosing again.

## How it is built

- Electron 33 (main process in `electron/`) and Svelte 5 with Vite (pages in `src/`).
- `src/lib/Stage.svelte` draws a slide on a 1920 × 1080 canvas. The output window and both previews all use it.
- The Bible is converted once into `public/bible.json` and searched in memory. There is no XML parsing at startup.
- The library is one JSON file in the app-data folder, written atomically, with the last ten versions kept in `backups/`.
- Telugu and English fonts are bundled, so the app works offline.
- The pages run sandboxed with context isolation. Pages are served from `app://` and backgrounds from `media://`, so web security stays on.

## Bible data

`public/bible.json` is built by `npm run bible` from two sources:

- **English:** `data/kjv.csv`, the King James Version from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) (public domain text, MIT-licensed data), all 31,102 verses. It replaced an older `kjv.json` that was missing or doubling verses in 10 chapters (Matthew 2, 22, 26, Mark 4, 7, 8, 1 Samuel 20, 1 Kings 22, 3 John, Revelation 12) and carried translators' margin notes on about 6,400 verses.
- **Telugu:** the BSI Telugu Bible XML (`data/telugu.xml`, or `../experiment/BSI_bible.xml`). Known issues in that file: Exodus 7:25 is missing (that verse shows in English only), and in Matthew 2:20 to 23 the verse boundaries are shifted. A cleaner Telugu source would fix both.

Book names and abbreviations in both languages are in `data/books.json`.

## Next

LAN control from phones, Telugu voice search, a live text editor, and an installer icon.

## Publishing a version

Pushing a tag builds every download on GitHub (`.github/workflows/release.yml`) and attaches them to a release; the website's buttons always point at the latest one.

```
npm version patch        # or minor, major: updates package.json and makes the tag
git push && git push --tags
```

The website is `docs/`, served by GitHub Pages from the `main` branch.

## Licence

MIT, see [LICENSE](LICENSE). The Bible texts (the Telugu Bible, BSI, and the King James Version) are bundled as data.
