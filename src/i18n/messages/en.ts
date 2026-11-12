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
