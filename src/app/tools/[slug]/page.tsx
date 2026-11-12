import { notFound } from 'next/navigation';
import { TOOL_PAGES, ToolPage, getToolPage } from '@/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOL_PAGES.map((page) => ({ slug: page.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getToolPage(slug);
  if (!entry) notFound();
  return <ToolPage entry={entry} />;
}
