/**
 * ChayaOne assistant identity — the single place that defines what the user
 * sees ("Chai"). The AI provider (Gemini) lives only in
 * app/api/dashboard/assistant/route.ts and is never imported here or
 * referenced by any client component.
 */

export type AssistantModule = 'home' | 'finance' | 'inventory';
export type UiLang = 'en' | 'ml';

export const ASSISTANT = {
  name: 'Chai',
  tagline: 'Your ChayaOne AI assistant',
} as const;

/** Array-driven so a future language (e.g. `{ code: 'ar', label: 'AR' }`) is a one-line addition. */
export const LANGUAGES: { code: UiLang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ml', label: 'മ' },
];

export const ASSISTANT_GREETING: Record<UiLang, string> = {
  en: 'Ask me anything — “why are sales down?”, “what to promote?” · മലയാളത്തിലും ചോദിക്കാം 🎙️',
  ml: 'എന്തും ചോദിക്കൂ — "വിൽപ്പന കുറഞ്ഞതെന്ത്?", "എന്ത് പ്രമോട്ട് ചെയ്യണം?" · English-ലും ചോദിക്കാം 🎙️',
};

/** Suggested-question chips, contextual per dashboard module. */
export const ASSISTANT_PROMPTS: Record<AssistantModule, Record<UiLang, string[]>> = {
  home: {
    en: ['Why up today?', 'Promote tonight?', 'Who to win back?', 'Busiest hours?'],
    ml: ['ഇന്നത്തെ വിൽപ്പന?', 'എന്ത് പ്രമോട്ട് ചെയ്യണം?', 'ആരെ തിരികെ കൊണ്ടുവരണം?', 'തിരക്കുള്ള സമയം?'],
  },
  finance: {
    en: ['Where did we spend the most?', "What are today's expenses?", 'Show unusual expenses.', 'Any dues pending?'],
    ml: ['ഏറ്റവും കൂടുതൽ ചെലവ് എവിടെ?', 'ഇന്നത്തെ ചെലവുകൾ?', 'അസാധാരണ ചെലവുകൾ കാണിക്കൂ.', 'ബാക്കി തുക വല്ലതുമുണ്ടോ?'],
  },
  inventory: {
    en: ['What is running low?', 'What should I reorder?', 'Slow-moving items?', "What's my stock worth?"],
    ml: ['എന്താണ് തീരാറായത്?', 'എന്ത് റീഓർഡർ ചെയ്യണം?', 'മന്ദഗതിയിലുള്ള ഐറ്റങ്ങൾ?', 'സ്റ്റോക്കിന്റെ മൂല്യം എത്ര?'],
  },
};
