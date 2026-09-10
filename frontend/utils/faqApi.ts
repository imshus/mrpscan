import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

export type FaqLanguage = 'en' | 'hi';

/** Every string is carried in both languages, so switching needs no request. */
export interface FaqText {
  en: string;
  hi: string;
}

export interface FaqItem {
  q: FaqText;
  a: FaqText;
}

export interface FaqSection {
  section: FaqText;
  items: FaqItem[];
}

const isText = (value: unknown): value is FaqText => {
  const text = value as FaqText | undefined;
  return Boolean(text && typeof text.en === 'string' && typeof text.hi === 'string');
};

/**
 * The FAQ, as the server holds it. Answers an empty list rather than throwing,
 * so the screen can say "couldn't load" instead of crashing.
 */
export async function fetchFaqs(): Promise<FaqSection[]> {
  const response = await apiRequest<Record<string, unknown>>('/faqs', { method: 'GET' });
  const data = unwrapApiData(response) as { sections?: unknown } | null;
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  return sections
    .map((raw): FaqSection | null => {
      const row = raw as Partial<FaqSection>;
      if (!isText(row.section) || !Array.isArray(row.items)) return null;
      const items = row.items.filter((item): item is FaqItem => isText(item?.q) && isText(item?.a));
      if (!items.length) return null;
      return { section: row.section, items };
    })
    .filter((row): row is FaqSection => row !== null);
}
