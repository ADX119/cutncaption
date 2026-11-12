import { t } from '@/i18n';
import { toolPath } from '@/seo';

const AREAS = [
  { href: toolPath('trim-video'), title: t('home.trim.title'), body: t('home.trim.body') },
  { href: toolPath('video-meme-maker'), title: t('home.meme.title'), body: t('home.meme.body') },
  {
    href: toolPath('auto-captions'),
    title: t('home.captions.title'),
    body: t('home.captions.body'),
  },
  {
    href: toolPath('crop-video-for-reels'),
    title: t('home.crop.title'),
    body: t('home.crop.body'),
  },
];

/** A timeline with a selected range: the one thing every tool here does. */
function TimelineStrip() {
  return (
    <div
      role="img"
      aria-label={t('home.strip.alt')}
      className="border-rule bg-sheet relative mt-12 h-16 overflow-hidden rounded-lg border sm:h-20"
    >
      <div
        className="text-rule absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, currentColor 0 1px, transparent 1px 100%)',
          backgroundSize: '3.125% 100%',
        }}
      />
      <div className="strip-selection bg-accent-wash border-accent absolute inset-y-0 right-[26%] left-[18%] border-y-2">
        <span className="bg-accent absolute inset-y-0 left-0 w-2 rounded-r-sm" />
        <span className="bg-accent absolute inset-y-0 right-0 w-2 rounded-l-sm" />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-14 sm:px-6 sm:pt-24">
      <h1 className="display max-w-[18ch] text-[clamp(2.25rem,7vw,4rem)] text-balance">
        {t('home.headline')}
      </h1>
      <p className="text-graphite mt-6 max-w-[52ch] text-lg leading-relaxed">{t('home.lede')}</p>

      <TimelineStrip />

      <ul className="divide-rule border-rule mt-12 divide-y border-y">
        {AREAS.map((area) => (
          <li key={area.href}>
            {/* Plain <a>: tool routes are cross-origin isolated (docs/ARCHITECTURE.md §4). */}
            <a
              href={area.href}
              className="group hover:bg-accent-wash -mx-4 grid gap-1 px-4 py-5 transition-colors duration-200 sm:-mx-6 sm:grid-cols-[16rem_1fr] sm:gap-8 sm:px-6"
            >
              <span className="display text-xl">{area.title}</span>
              <span className="text-graphite group-hover:text-ink max-w-[56ch] transition-colors duration-200">
                {area.body}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
