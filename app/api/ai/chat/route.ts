import { NextResponse } from "next/server";
import {
  getAssistantAgent,
  normalizeAssistantMode,
  normalizeSpecialistAssistantMode,
  type AssistantMode,
  type AssistantWorkflow,
  type SpecialistAssistantMode,
} from "@/lib/ai/agents";
import { buildAnalytics, buildExposure, buildKpis, mapBankrollRow, mapBetRow, mapWatchlistRow } from "@/lib/supabase/dashboard-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: AssistantMode;
};

type ChatRequest = {
  message?: string;
  history?: ChatMessage[];
  mode?: AssistantMode;
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

type RouterDecision = {
  primaryMode: SpecialistAssistantMode;
  reasoning: string;
  needsRiskReview: boolean;
};

type AssistantApiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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
    .map((item) => ({ role: item.role, mode: normalizeAssistantMode(item.mode), content: item.content.slice(0, 3000) }));
}

function computeMaxDrawdownPct(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  let peak = values[0];
  let maxDrawdown = 0;

  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, ((peak - value) / peak) * 100);
    }
  }

  return maxDrawdown;
}

function buildAgentPrompt(agentMode: SpecialistAssistantMode, contextPayload: string): string {
  const agent = getAssistantAgent(agentMode);

  return [
    "You are CLUTCH AI, a sports betting assistant inside a live dashboard.",
    `Active specialist agent: ${agent.label}.`,
    `Agent brief: ${agent.description}`,
    "You must only use the provided user data context and avoid hallucinating unseen bets or bankroll values.",
    "Guidelines:",
    "- Be concise and useful.",
    "- Use bullets where appropriate.",
    "- Include numeric evidence from context when giving insights.",
    "- If data is missing, say what is missing and suggest what to track next.",
    "- Never claim guaranteed outcomes or certainty.",
    "- Keep language action-oriented and non-judgmental.",
    ...agent.systemFocus.map((rule) => `- ${rule}`),
    "Data context JSON follows:",
    contextPayload,
  ].join("\n");
}

async function requestOpenRouter(apiKey: string, messages: AssistantApiMessage[]) {
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
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter request failed: ${text.slice(0, 300)}`);
  }

  const completion = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = completion.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return content;
}

function normalizeRouterDecision(value: unknown): RouterDecision | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const primaryMode = normalizeSpecialistAssistantMode(record.primaryMode);
  const reasoning = typeof record.reasoning === "string" ? record.reasoning.trim() : "";
  const needsRiskReview = typeof record.needsRiskReview === "boolean" ? record.needsRiskReview : false;

  return {
    primaryMode,
    reasoning: reasoning || "Router selected the most relevant specialist from the request.",
    needsRiskReview,
  };
}

function keywordMatches(message: string, pattern: RegExp) {
  return pattern.test(message.toLowerCase());
}

function fallbackRouterDecision(message: string): RouterDecision {
  if (keywordMatches(message, /(predict|pick|best bet|edge|confidence|stake)/i)) {
    return { primaryMode: "prediction", reasoning: "Prediction language detected in the request.", needsRiskReview: true };
  }

  if (keywordMatches(message, /(bankroll|stake|sizing|drawdown|tilt|risk|exposure)/i)) {
    return { primaryMode: "bankroll", reasoning: "Risk or bankroll management language detected in the request.", needsRiskReview: false };
  }

  if (keywordMatches(message, /(recap|summary|postmortem|review|week|daily|weekly|last)/i)) {
    return { primaryMode: "recap", reasoning: "Recap-style language detected in the request.", needsRiskReview: false };
  }

  if (keywordMatches(message, /(watchlist|team|teams|track|scout|monitor)/i)) {
    return { primaryMode: "watchlist", reasoning: "Watchlist or scouting language detected in the request.", needsRiskReview: false };
  }

  return { primaryMode: "default", reasoning: "No specialist intent dominated, so the workflow kept the general analyst.", needsRiskReview: false };
}

async function routeAutoWorkflow(apiKey: string, message: string, summary: string): Promise<RouterDecision> {
  const routerPrompt = [
    "You are the CLUTCH workflow router.",
    "Choose the best specialist agent for the user request.",
    "Allowed primaryMode values: default, prediction, bankroll, recap, watchlist.",
    "Return ONLY JSON with keys: primaryMode, reasoning, needsRiskReview.",
    "Set needsRiskReview true when the request involves prediction, aggressive staking, concentrated exposure, tilt, or bankroll danger.",
    "Do not answer the user question directly.",
    "Data summary follows:",
    summary,
  ].join("\n");

  try {
    const content = await requestOpenRouter(apiKey, [
      { role: "system", content: routerPrompt },
      { role: "user", content: message },
    ]);

    return normalizeRouterDecision(extractJsonObject(content)) ?? fallbackRouterDecision(message);
  } catch {
    return fallbackRouterDecision(message);
  }
}

async function runSpecialistAgent(
  apiKey: string,
  agentMode: SpecialistAssistantMode,
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
) {
  const conversation: AssistantApiMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: message },
  ];

  if (agentMode === "prediction") {
    conversation[0].content +=
      "\nPrediction mode is active. Return ONLY valid JSON with keys: title, pick, confidence (0-100), rationale (string[]), riskFlags (string[]), recommendedStakePct (0-100), timeHorizon.";
  }

  return requestOpenRouter(apiKey, conversation);
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
  const mode = normalizeAssistantMode(body.mode);

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
  const currentBankroll = bankroll[bankroll.length - 1]?.value ?? null;
  const totalOpenStake = exposure.reduce((sum, item) => sum + item.openStake, 0);
  const topExposureShare = exposure[0]?.share ?? 0;
  const settledBets = bets.filter((bet) => bet.status !== "pending").length;
  const maxDrawdownPct = computeMaxDrawdownPct(bankroll.map((item) => item.value));

  const contextPayload = {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? null,
    },
    summary: {
      totalBets: bets.length,
      settledBets,
      pendingBets: bets.filter((bet) => bet.status === "pending").length,
      currentBankroll,
      watchlistCount: watchlist.length,
      topExposureShare,
      totalOpenStake,
      maxDrawdownPct,
    },
    kpis,
    exposure,
    segments,
    recentBets: bets.slice(0, 35),
    bankroll,
    watchlist,
  };

  const contextJson = JSON.stringify(contextPayload);
  const routingSummary = JSON.stringify({
    message,
    summary: contextPayload.summary,
    topKpis: kpis,
    topExposure: exposure.slice(0, 3),
    topSegments: segments.slice(0, 5),
    watchlistPreview: watchlist.slice(0, 5),
  });

  const serverHistoryResponse = await supabase
    .from("ai_chat_messages")
    .select("role,content")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .order("created_at", { ascending: true })
    .limit(12);

  const serverHistory = serverHistoryResponse.error
    ? []
    : (serverHistoryResponse.data ?? []).filter(
        (item): item is ChatMessage =>
          (item.role === "user" || item.role === "assistant") && typeof item.content === "string",
      );

  const localHistory = clampHistory(body.history).filter((item) => normalizeAssistantMode(item.mode) === mode);
  const historyForMode = serverHistory.length ? serverHistory : localHistory;

  let primaryMode: SpecialistAssistantMode = mode === "auto" ? "default" : normalizeSpecialistAssistantMode(mode);
  let workflowReasoning = "Manual specialist selection.";
  const agentsUsed = [mode === "auto" ? "Auto Router" : getAssistantAgent(primaryMode).label];
  const branchesTaken: string[] = [];

  if (mode === "auto") {
    const routerDecision = await routeAutoWorkflow(apiKey, message, routingSummary);
    primaryMode = routerDecision.primaryMode;
    workflowReasoning = routerDecision.reasoning;
    agentsUsed.push(getAssistantAgent(primaryMode).label);

    if (routerDecision.needsRiskReview) {
      branchesTaken.push("Router flagged this request for bankroll risk review.");
    }
  }

  const requestedPrediction = primaryMode === "prediction";
  const riskRequested = keywordMatches(message, /(bankroll|stake|sizing|risk|tilt|drawdown|exposure)/i);
  const highRiskProfile = topExposureShare >= 0.45 || (currentBankroll !== null && currentBankroll > 0 && totalOpenStake / currentBankroll >= 0.12) || maxDrawdownPct >= 12;

  if (primaryMode === "watchlist" && watchlist.length === 0) {
    primaryMode = "default";
    branchesTaken.push("Watchlist branch fell back to General Analyst because no watchlist teams are stored yet.");
  }

  if (primaryMode === "recap" && settledBets < 5) {
    primaryMode = "default";
    branchesTaken.push("Recap branch fell back to General Analyst because there are fewer than 5 settled bets.");
  }

  const shouldRunRiskReview = primaryMode !== "bankroll" && (requestedPrediction || riskRequested || highRiskProfile);
  if (shouldRunRiskReview) {
    branchesTaken.push("Risk review branch ran through Bankroll Coach because the request or portfolio profile triggered bankroll safeguards.");
  }

  let content: string;

  try {
    const primaryPrompt = buildAgentPrompt(primaryMode, contextJson);
    const primaryContent = await runSpecialistAgent(apiKey, primaryMode, primaryPrompt, historyForMode, message);

    if (shouldRunRiskReview) {
      agentsUsed.push(getAssistantAgent("bankroll").label);
      const riskPrompt = buildAgentPrompt("bankroll", contextJson);
      const riskContent = await runSpecialistAgent(
        apiKey,
        "bankroll",
        `${riskPrompt}\nYou are reviewing another specialist draft. Focus only on bankroll guardrails, exposure warnings, stake discipline, and downside control.`,
        [],
        `Original user request:\n${message}\n\nPrimary specialist draft:\n${primaryContent}`,
      );
      content = `${primaryContent}\n\nBankroll Coach Review\n${riskContent}`;
    } else {
      content = primaryContent;
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Assistant request failed.";
    return NextResponse.json({ error: messageText }, { status: 502 });
  }

  let reply = content;
  let predictionCard: PredictionCard | null = null;
  const workflow: AssistantWorkflow = {
    routeMode: mode,
    primaryAgent: primaryMode,
    agentsUsed,
    branchesTaken,
    reasoning: workflowReasoning,
  };

  if (primaryMode === "prediction") {
    predictionCard = normalizePredictionCard(extractJsonObject(content));

    if (predictionCard) {
      reply = [
        `${predictionCard.title}`,
        `Pick: ${predictionCard.pick}`,
        `Confidence: ${predictionCard.confidence.toFixed(0)}%`,
        `Stake: ${predictionCard.recommendedStakePct.toFixed(1)}% bankroll`,
        `Horizon: ${predictionCard.timeHorizon}`,
      ].join("\n");

      if (branchesTaken.length) {
        reply += `\n\nWorkflow Notes\n- ${branchesTaken.join("\n- ")}`;
      }
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
      workflow,
    },
  ]);

  return NextResponse.json({ data: { reply, predictionCard, workflow } });
}
