import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sitecore timestamps are YYYYMMDDTHHMMSSZ (e.g. 20260917T114320Z).
 */
export function formatSitecoreDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return raw;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  if (isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}