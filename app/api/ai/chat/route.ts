import { NextResponse } from "next/server";
import { buildAnalytics, buildExposure, buildKpis, mapBankrollRow, mapBetRow, mapWatchlistRow } from "@/lib/supabase/dashboard-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message?: string;
  history?: ChatMessage[];
  mode?: "default" | "prediction";
};

type PredictionCard = {
  title: string;
  pick: string;
  confidence: number;
  rationale: string[];
  riskFlags: string[];
  recommendedStakePct: number;
  timeHorizon: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();

  if (trimmed.startsWith("```")) {
    const normalized = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function normalizePredictionCard(value: unknown): PredictionCard | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "Prediction Card";
  const pick = typeof record.pick === "string" ? record.pick.trim() : "";
  const confidence = typeof record.confidence === "number" ? Math.max(0, Math.min(100, record.confidence)) : Number(record.confidence ?? 0);
  const rationale = Array.isArray(record.rationale) ? record.rationale.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  const riskFlags = Array.isArray(record.riskFlags) ? record.riskFlags.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  const recommendedStakePct = typeof record.recommendedStakePct === "number" ? Math.max(0, Math.min(100, record.recommendedStakePct)) : Number(record.recommendedStakePct ?? 0);
  const timeHorizon = typeof record.timeHorizon === "string" ? record.timeHorizon.trim() : "Next slate";

  if (!pick || Number.isNaN(confidence) || Number.isNaN(recommendedStakePct)) {
    return null;
  }

  return {
    title: title || "Prediction Card",
    pick,
    confidence,
    rationale,
    riskFlags,
    recommendedStakePct,
    timeHorizon,
  };
}

function clampHistory(history: ChatMessage[] | undefined): ChatMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item): item is ChatMessage => (item?.role === "user" || item?.role === "assistant") && typeof item?.content === "string")
    .slice(-12)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 3000) }));
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OpenRouter is not configured. Set OPENROUTER_API_KEY." }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ChatRequest;
  const message = String(body.message ?? "").trim();
  const mode = body.mode === "prediction" ? "prediction" : "default";

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const [betsResponse, bankrollResponse, watchlistResponse] = await Promise.all([
    supabase
      .from("bets")
      .select("id,ticket_code,placed_at,sport,market,odds_american,bet_type,parlay_legs_count,combined_odds_american,stake,to_win,book,status,result,opening_line,betting_line,closing_line,public_bet_pct,public_money_pct")
      .eq("user_id", user.id)
      .order("placed_at", { ascending: false })
      .limit(150),
    supabase
      .from("bankroll_snapshots")
      .select("id,snapshot_date,value")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: true })
      .limit(180),
    supabase
      .from("watchlist_teams")
      .select("id,code,league,name,record,form,reliability")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  if (betsResponse.error || bankrollResponse.error || watchlistResponse.error) {
    return NextResponse.json({ error: "Unable to load live account data for AI context." }, { status: 500 });
  }

  const bets = (betsResponse.data ?? []).map(mapBetRow);
  const bankroll = (bankrollResponse.data ?? []).map(mapBankrollRow);
  const watchlist = (watchlistResponse.data ?? []).map(mapWatchlistRow);
  const kpis = buildKpis(bets);
  const exposure = buildExposure(bets);
  const segments = buildAnalytics(bets);

  const contextPayload = {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? null,
    },
    summary: {
      totalBets: bets.length,
      settledBets: bets.filter((bet) => bet.status !== "pending").length,
      pendingBets: bets.filter((bet) => bet.status === "pending").length,
      currentBankroll: bankroll[bankroll.length - 1]?.value ?? null,
      watchlistCount: watchlist.length,
    },
    kpis,
    exposure,
    segments,
    recentBets: bets.slice(0, 35),
    bankroll,
    watchlist,
  };

  const systemPrompt = [
    "You are CLUTCH AI, a sports betting assistant inside a live dashboard.",
    "You must only use the provided user data context and avoid hallucinating unseen bets or bankroll values.",
    "Capabilities expected: bet note summarization, natural-language analytics answers, AI-generated insights over betting history, and practical next-step suggestions.",
    "Guidelines:",
    "- Be concise and useful.",
    "- Use bullets where appropriate.",
    "- Include numeric evidence from context when giving insights.",
    "- If data is missing, say what is missing and suggest what to track next.",
    "- Never claim guaranteed outcomes or certainty.",
    "- Keep language action-oriented and non-judgmental.",
    "Data context JSON follows:",
    JSON.stringify(contextPayload),
  ].join("\n");

  const serverHistoryResponse = await supabase
    .from("ai_chat_messages")
    .select("role,content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(12);

  const serverHistory = serverHistoryResponse.error
    ? []
    : (serverHistoryResponse.data ?? []).filter(
        (item): item is ChatMessage =>
          (item.role === "user" || item.role === "assistant") && typeof item.content === "string",
      );

  const conversation = [
    { role: "system", content: systemPrompt },
    ...(serverHistory.length ? serverHistory : clampHistory(body.history)),
    { role: "user", content: message },
  ];

  if (mode === "prediction") {
    conversation[0].content +=
      "\nPrediction mode is active. Return ONLY valid JSON with keys: title, pick, confidence (0-100), rationale (string[]), riskFlags (string[]), recommendedStakePct (0-100), timeHorizon.";
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://clutch.local",
      "X-Title": "Clutch Dashboard Assistant",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 900,
      messages: conversation,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `OpenRouter request failed: ${text.slice(0, 300)}` }, { status: 502 });
  }

  const completion = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = completion.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "OpenRouter returned an empty response." }, { status: 502 });
  }

  let reply = content;
  let predictionCard: PredictionCard | null = null;

  if (mode === "prediction") {
    predictionCard = normalizePredictionCard(extractJsonObject(content));

    if (predictionCard) {
      reply = [
        `${predictionCard.title}`,
        `Pick: ${predictionCard.pick}`,
        `Confidence: ${predictionCard.confidence.toFixed(0)}%`,
        `Stake: ${predictionCard.recommendedStakePct.toFixed(1)}% bankroll`,
        `Horizon: ${predictionCard.timeHorizon}`,
      ].join("\n");
    }
  }

  await supabase.from("ai_chat_messages").insert([
    {
      user_id: user.id,
      role: "user",
      mode,
      content: message,
    },
    {
      user_id: user.id,
      role: "assistant",
      mode,
      content: reply,
      prediction: predictionCard,
    },
  ]);

  return NextResponse.json({ data: { reply, predictionCard } });
}
