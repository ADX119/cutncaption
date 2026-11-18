import { t } from '@/i18n';
import { toolPath } from '@/seo';

interface Area {
  readonly title: string;
  readonly body: string;
  /** Working tools in this area; an area without any is shown as coming soon. */
  readonly tools: readonly { readonly slug: string; readonly label: string }[];
}

const AREAS: readonly Area[] = [
  {
    title: t('home.trim.title'),
    body: t('home.trim.body'),
    tools: [
      { slug: 'trim-video', label: t('home.tool.trim') },
      { slug: 'compress-video', label: t('home.tool.compress') },
      { slug: 'compress-video-to-size', label: t('home.tool.size') },
      { slug: 'compress-video-for-whatsapp', label: t('home.tool.whatsapp') },
      { slug: 'compress-video-for-discord', label: t('home.tool.discord') },
      { slug: 'convert-to-mp4', label: t('home.tool.convert') },
      { slug: 'video-to-mp3', label: t('home.tool.mp3') },
      { slug: 'mute-video', label: t('home.tool.mute') },
    ],
  },
  { title: t('home.meme.title'), body: t('home.meme.body'), tools: [] },
  { title: t('home.captions.title'), body: t('home.captions.body'), tools: [] },
  { title: t('home.crop.title'), body: t('home.crop.body'), tools: [] },
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
          <li
            key={area.title}
            className="grid gap-1 py-5 sm:grid-cols-[16rem_1fr] sm:gap-8"
            data-testid="home-area"
          >
            <h2 className={`display text-xl ${area.tools.length ? '' : 'text-graphite'}`}>
              {area.title}
            </h2>
            <div>
              <p className="text-graphite max-w-[56ch]">{area.body}</p>
              {area.tools.length ? (
                <ul
                  aria-label={t('home.tools.label', { area: area.title })}
                  className="mt-3 -ml-3 flex flex-wrap gap-1"
                >
                  {area.tools.map((tool) => (
                    <li key={tool.slug}>
                      {/* Plain <a>: tool routes are cross-origin isolated (docs/ARCHITECTURE.md §4). */}
                      <a
                        href={toolPath(tool.slug)}
                        className="pressable text-accent hover:bg-accent-wash flex min-h-11 items-center rounded-full px-3 font-medium underline-offset-4 hover:underline"
                      >
                        {tool.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-graphite mt-2 text-sm">{t('home.soon')}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
