export type Ctx = { config: Record<string, any>; facts: Record<string, any> };
export function numberToWords(n: number): string;
export function usd(n: number): string;
export function usdShort(n: number): string;
export function resolveText(s: string, ctx: Ctx): string;
export function resolveDeep<T>(o: T, ctx: Ctx): T;
export function cleanTitle(s: string): string;
