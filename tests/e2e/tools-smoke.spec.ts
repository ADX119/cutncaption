import { TOOL_PAGES } from '../../src/seo/registry';
import { openToolWith } from './support/tools';
import { expect, test } from './support/test';

/** The screen each core tool shows once a file is ready, and what its page preset selects. */
const CORE_TOOLS: Record<string, { testId: string; selected?: string }> = {
  'trim-video': { testId: 'trim-tool', selected: 'Precise' },
  'compress-video': { testId: 'compress-tool', selected: 'Balanced' },
  'compress-video-to-size': { testId: 'size-tool', selected: 'Custom' },
  'compress-video-for-whatsapp': { testId: 'size-tool', selected: 'WhatsApp' },
  'compress-video-for-discord': { testId: 'size-tool', selected: 'Discord' },
  'convert-to-mp4': { testId: 'convert-tool' },
  'mov-to-mp4': { testId: 'convert-tool' },
  'video-to-mp3': { testId: 'mp3-tool', selected: 'High' },
  'mute-video': { testId: 'mute-tool' },
};

test('every core tool page is in the registry', () => {
  const slugs = TOOL_PAGES.map((page) => page.slug);
  for (const slug of Object.keys(CORE_TOOLS)) expect(slugs).toContain(slug);
});

for (const [slug, { testId, selected }] of Object.entries(CORE_TOOLS)) {
  test(`${slug} takes a file and opens its tool`, async ({ page }) => {
    test.setTimeout(120_000);
    await openToolWith(page, `/tools/${slug}/`, 'clip.mov', testId);
    if (selected) await expect(page.getByRole('radio', { name: selected })).toBeChecked();
  });
}
