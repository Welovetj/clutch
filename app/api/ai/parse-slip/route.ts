import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are a sports betting assistant that extracts structured data from sportsbook bet confirmation screenshots or raw pasted text.

Extract the following fields and return ONLY valid JSON — no markdown fences, no explanation:
{
  "ticketCode": "string (bet ID / confirmation number, or empty string)",
  "placedAt": "ISO 8601 datetime string if detectable, otherwise empty string",
  "sport": "sport name e.g. NFL, NBA, NHL, MLB, Soccer, Tennis (or empty string)",
  "market": "bet market type e.g. spread, moneyline, total, player prop (or empty string)",
  "oddsAmerican": number (American-format odds e.g. -110 or 250; 0 if unknown),
  "stake": number (amount wagered in dollars; 0 if unknown),
  "toWin": number (potential payout / to-win amount in dollars; 0 if unknown),
  "book": "sportsbook name e.g. DraftKings, FanDuel, Bet365 (or empty string)",
  "status": "pending, won, or lost"
}

If a field cannot be determined, use an empty string for strings and 0 for numbers.
If status is unknown, set it to "pending".
Never include any text outside the JSON object.`;

type ParseSlipRequest = {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
};

type ParsedSlip = {
  ticketCode: string;
  placedAt: string;
  sport: string;
  market: string;
  oddsAmerican: number;
  stake: number;
  toWin: number;
  book: string;
  status: "won" | "lost" | "pending";
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toStatus(value: unknown): ParsedSlip["status"] {
  if (value === "won" || value === "lost") {
    return value;
  }
  return "pending";
}

function normalizeParsedSlip(value: unknown): ParsedSlip | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    ticketCode: String(row.ticketCode ?? row.ticket_code ?? "").trim(),
    placedAt: String(row.placedAt ?? row.date ?? row.placed_at ?? "").trim(),
    sport: String(row.sport ?? "").trim(),
    market: String(row.market ?? row.marketType ?? row.market_type ?? "").trim(),
    oddsAmerican: toNumber(row.oddsAmerican ?? row.odds_american),
    stake: toNumber(row.stake),
    toWin: toNumber(row.toWin ?? row.potentialPayout ?? row.potential_payout),
    book: String(row.book ?? row.sportsbook ?? "").trim(),
    status: toStatus(row.status ?? row.betStatus ?? row.bet_status),
  };
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const body = (await request.json()) as ParseSlipRequest;
  const { text, imageBase64, mimeType } = body;

  if (!text?.trim() && !imageBase64) {
    return NextResponse.json({ error: "Provide text or image" }, { status: 400 });
  }

  type UserContent =
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>;

  let userContent: UserContent;
  if (imageBase64 && mimeType) {
    userContent = [
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${imageBase64}` },
      },
      {
        type: "text",
        text: "Extract all bet slip details from this sportsbook screenshot.",
      },
    ];
  } else {
    userContent = text ?? "";
  }

  const aiResponse = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://clutch.app",
      "X-Title": "CLUTCH",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!aiResponse.ok) {
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }

  const result = (await aiResponse.json()) as OpenRouterResponse;
  const raw = result.choices?.[0]?.message?.content ?? "";

  let parsed: unknown = null;

  try {
    const trimmed = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    parsed = JSON.parse(trimmed);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {
        // falls through to error below
      }
    }
  }

  const normalized = normalizeParsedSlip(parsed);

  if (!normalized) {
    return NextResponse.json({ error: "Could not parse bet slip" }, { status: 422 });
  }

  return NextResponse.json({ data: normalized });
}
