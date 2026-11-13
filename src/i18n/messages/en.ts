/**
 * English message catalogue. Every user-visible string lives here.
 * Placeholders use {name}; t() requires a value for each one at compile time.
 */
export const en = {
  'app.name': 'cutncaption',
  'app.tagline': 'Free, private clip, meme and caption studio that runs in your browser.',

  'nav.home': 'cutncaption home',
  'nav.tools': 'Tools',
  'nav.trim': 'Trim',
  'nav.meme': 'Meme',
  'nav.captions': 'Captions',
  'nav.crop': 'Crop',
  'theme.toggle': 'Switch between light and dark theme',
  'footer.privacy':
    'Your files are processed on this device and are never uploaded. No account, no watermark, no ads.',

  'file.drop.title': 'Drop a video or audio file here',
  'file.drop.hint': 'Or choose one from your device. It is never uploaded.',
  'file.choose': 'Choose a file',
  'file.chooseAnother': 'Choose another file',
  'file.reject.not-a-file':
    'That was not a file. Drop a video or audio file from your device; links cannot be opened.',
  'file.reject.too-many': 'One file at a time. Drop a single file.',
  'file.reject.wrong-type':
    'This file type isn’t supported. Try MP4, MOV, WebM, MKV, AVI, MP3, WAV, M4A, AAC or OGG.',
  'file.reject.empty': 'This file is empty. Choose another one.',

  'browser.inApp.title': 'Open this page in your browser',
  'browser.inApp.body':
    'The browser built into {app} cannot save files reliably. Open its menu and choose “Open in browser”, or copy this link and paste it into Chrome or Safari.',
  'browser.inApp.copy': 'Copy link',
  'browser.inApp.copied': 'Link copied',
  'browser.inApp.copyFailed': 'Copying was blocked. Press and hold the link above to copy it.',
  'browser.app.instagram': 'Instagram',
  'browser.app.facebook': 'Facebook',
  'browser.app.tiktok': 'TikTok',
  'browser.app.line': 'LINE',
  'browser.unsupported.title': 'This browser cannot run the tools',
  'browser.unsupported.body':
    'It is missing: {features}. Update your browser, or use a current version of Chrome, Edge, Firefox or Safari.',
  'browser.feature.wasm': 'WebAssembly',
  'browser.feature.wasm-simd': 'WebAssembly SIMD',
  'browser.feature.workers': 'web workers',
  'browser.feature.cache-storage': 'file caching',

  // One per EngineErrorCode (src/engine/errors.ts): what happened, then what to do.
  'error.cancelled': 'Cancelled. Nothing was changed.',
  'error.asset-unknown': 'Part of the editor is missing from this version. Reload the page.',
  'error.asset-download-failed':
    'The editor could not finish downloading. Check your connection and try again.',
  'error.asset-corrupt': 'The editor download was damaged on the way. Try again.',

  'home.headline': 'Trim, caption and meme your videos, right in your browser.',
  'home.lede':
    'Pick a file from your device and get to work. Nothing is uploaded, so your video stays yours.',
  'home.strip.alt': 'A video timeline with a section selected between two trim handles.',
  'home.trim.title': 'Trim and compress',
  'home.trim.body': 'Cut a clip, shrink it for WhatsApp, convert it to MP4 or pull out the audio.',
  'home.meme.title': 'Meme studio',
  'home.meme.body': 'Mark a moment, add a caption, and save it as a video, GIF or sticker.',
  'home.captions.title': 'Auto captions',
  'home.captions.body': 'Get captions in English or Hindi, fix them, then burn them in or export.',
  'home.crop.title': 'Crop for Reels and Shorts',
  'home.crop.body': 'Reframe a wide video to 9:16 with guides for each platform.',
} as const;
