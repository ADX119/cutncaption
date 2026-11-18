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

  'engineDownload.title': 'Getting the editor ready',
  'engineDownload.amount': '{loaded} of {total}',
  'engineDownload.hint':
    'This happens once. The editor is kept on this device, so next time it starts straight away.',
  'file.reading': 'Reading your file…',
  'file.details': '{duration} · {size}',
  'file.detailsVideo': '{duration} · {width} × {height} · {size}',

  'timeline.start': 'Start of selection',
  'timeline.end': 'End of selection',
  'timeline.length': '{length} selected',
  'timeline.invalidTime': 'Type a time like 1:05.2',
  'timeline.startField': 'Start',
  'timeline.endField': 'End',
  'preview.timeline': 'Timeline',
  'preview.video': 'Your video',

  'trim.mode': 'How to cut',
  'trim.precise': 'Precise',
  'trim.preciseHint': 'Cuts exactly where you chose and saves an MP4. Takes a little longer.',
  'trim.fast': 'Fast',
  'trim.fastHint':
    'Instant, keeps the original quality and format. The start may move to the nearest keyframe, up to a few seconds early.',
  'trim.run': 'Trim video',
  'trim.running': 'Trimming',
  'compress.quality': 'Size',
  'compress.light': 'Light',
  'compress.lightHint': 'Keeps the most detail, up to 1080p. A modest saving.',
  'compress.balanced': 'Balanced',
  'compress.balancedHint': 'Good for sharing, up to 720p. A big saving with little visible loss.',
  'compress.small': 'Small',
  'compress.smallHint': 'Smallest file, up to 480p. Best for messaging apps.',
  'compress.estimate': 'About {size}',
  'compress.from': ' from {size}',
  'compress.alreadySmall':
    'This video is already compact, so this setting may not make it much smaller. Try Small.',
  'compress.run': 'Compress video',
  'compress.running': 'Compressing',
  'compress.notSmallerTitle': 'Your original is already smaller',
  'compress.notSmallerBody':
    'Compressing did not make this video any smaller, so there is nothing to gain. Keep your original, or try the Small setting.',
  'compress.trySmall': 'Try Small',
  'compress.keepOriginal': 'Keep original',
  'limits.slowWarning':
    'This is a long job for this device. It may take a while; keep this tab open until it finishes.',

  'job.working': 'Working…',
  'job.percent': '{percent}%',
  'job.cancel': 'Cancel',
  'job.cancelling': 'Cancelling…',
  'result.size': '{before} → {after}',
  'result.smaller': '{percent}% smaller',
  'result.larger': '{percent}% larger',
  'result.download': 'Download',
  'result.share': 'Share',
  'result.startOver': 'Start over',
  'errorPanel.details': 'Details',
  'errorPanel.tryAgain': 'Try again',

  // One per EngineErrorCode (src/engine/errors.ts): what happened, then what to do.
  'error.cancelled': 'Cancelled. Nothing was changed.',
  'error.asset-unknown': 'Part of the editor is missing from this version. Reload the page.',
  'error.asset-download-failed':
    'The editor could not finish downloading. Check your connection and try again.',
  'error.asset-corrupt': 'The editor download was damaged on the way. Try again.',

  'error.engine-load-failed':
    'The editor could not start in this browser. Reload the page, or try another browser.',

  'error.unreadable-file':
    'This file could not be read. It may be damaged, or not a video or audio file. Try another file.',

  'error.out-of-memory':
    'This device ran out of memory for this job. Try a shorter clip or a smaller size, or close other tabs.',
  'error.job-failed':
    'Something went wrong while processing. Try again; if it keeps happening, try another file.',

  'error.stalled':
    'Processing stopped responding. Try again; if it happens again, try a shorter clip or reload the page.',

  'error.busy': 'Another job is still running. Wait for it to finish, or cancel it.',
  'error.input-too-large':
    'This file is too large for this device. Trim it on another device first, or try a shorter clip.',
  'error.output-too-large':
    'The result would be too large for this device to hold. Choose a smaller size or a shorter clip.',
  'error.caption-audio-too-long':
    'This video is too long for captions on this device. Trim it to a shorter part first.',

  'preview.title': 'Job states',
  'preview.converting': 'Converting',

  'error.already-under-target':
    'This video is already under that size, so there is nothing to do. Keep your original.',
  'error.target-unreachable':
    'That size is too small for this video to stay watchable. Choose a larger size, or trim the video first.',

  'engineCheck.title': 'Engine check',
  'engineCheck.intro':
    'This loads the video engine in your browser and reports what it finds. Nothing is uploaded.',
  'engineCheck.run': 'Run the check',
  'engineCheck.running': 'Checking…',
  'engineCheck.failed': 'The check could not finish.',
  'engineCheck.ffmpeg': 'FFmpeg version',
  'engineCheck.features': 'Required features',
  'engineCheck.featuresAll': 'All {count} present',
  'engineCheck.featuresMissing': 'Missing: {list}',
  'engineCheck.loadTime': 'Time to load',
  'engineCheck.seconds': '{seconds} s',
  'engineCheck.fromCache': 'Loaded from this device',
  'engineCheck.deviceClass': 'Device class',
  'engineCheck.isolated': 'Isolated page',
  'engineCheck.threads': 'Multi-threading available',
  'engineCheck.yes': 'Yes',
  'engineCheck.no': 'No',

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
