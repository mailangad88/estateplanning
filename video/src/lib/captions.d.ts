export type Page = { text: string; startMs: number; endMs: number; tokens: { text: string; fromMs: number; toMs: number }[] };
export function buildPages(video: any, limits: { maxChars: number; maxWords: number }): Page[];
export function toVtt(pages: Page[]): string;
export const HORIZONTAL_LIMITS: { maxChars: number; maxWords: number };
export const VERTICAL_LIMITS: { maxChars: number; maxWords: number };
