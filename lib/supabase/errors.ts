import { getSupabaseConfig } from "@/lib/supabase/config";

function getSupabaseHostLabel(): string {
  const config = getSupabaseConfig();

  if (!config) {
    return "Supabase (not configured)";
  }

  try {
    return new URL(config.url).host;
  } catch {
    return config.url;
  }
}

export function toSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (/failed to fetch|fetch failed/i.test(error.message)) {
    return `Unable to reach Supabase (${getSupabaseHostLabel()}). Update NEXT_PUBLIC_SUPABASE_URL in .env.local to your active project URL, then restart the dev server.`;
  }

  if (/unexpected token\s*'?</i.test(error.message)) {
    return `Supabase returned an HTML error page instead of API JSON (${getSupabaseHostLabel()}). This usually means the project is paused or unavailable. Resume the project in Supabase, then try again.`;
  }

  return error.message;
}