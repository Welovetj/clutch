export type SpecialistAssistantMode = "default" | "prediction" | "bankroll" | "recap" | "watchlist";

export type AssistantMode = "auto" | SpecialistAssistantMode;

export type AssistantAgentDefinition = {
  mode: AssistantMode;
  label: string;
  badge: string;
  description: string;
  inputPlaceholder: string;
  emptyState: string;
  quickPrompts: string[];
  systemFocus: string[];
};

export type AssistantWorkflow = {
  routeMode: AssistantMode;
  primaryAgent: SpecialistAssistantMode;
  agentsUsed: string[];
  branchesTaken: string[];
  reasoning: string;
};

export const ASSISTANT_AGENTS: AssistantAgentDefinition[] = [
  {
    mode: "auto",
    label: "Auto Workflow",
    badge: "Router",
    description: "Automatically routes your request through the right specialist agents and branch checks.",
    inputPlaceholder: "Ask anything and let the workflow route it...",
    emptyState: "Auto Workflow routes your request to the right specialist, adds risk review when needed, and falls back when the required data is missing.",
    quickPrompts: [
      "What should I focus on right now based on my data?",
      "Give me the best next action from my current betting profile.",
      "Review my current situation and tell me what matters most.",
      "Route this to the right specialist and explain the result.",
    ],
    systemFocus: [
      "Coordinate the right specialists instead of answering directly when a more targeted workflow would help.",
      "Explain which agent path was used and why.",
    ],
  },
  {
    mode: "default",
    label: "General Analyst",
    badge: "Core",
    description: "Broad analytics Q&A over live betting history, KPIs, and recent results.",
    inputPlaceholder: "Ask about notes, trends, or insights...",
    emptyState: "Ask about your live betting history. Examples: summarize bet notes, explain ROI segments, or generate risk-control insights.",
    quickPrompts: [
      "Summarize my recent bets into short notes.",
      "What patterns do you see in my ROI by segment?",
      "Give 3 risk-control insights from my bankroll and open exposure.",
      "What should I focus on this week based on my betting history?",
    ],
    systemFocus: [
      "Handle broad dashboard questions using only the supplied betting, bankroll, exposure, and watchlist context.",
      "Prioritize direct answers with numeric evidence and next-step suggestions.",
    ],
  },
  {
    mode: "prediction",
    label: "Prediction Lab",
    badge: "Model",
    description: "Structured pick card output with confidence, rationale, stake size, and risk flags.",
    inputPlaceholder: "Ask for a prediction card tied to your current data...",
    emptyState: "Generate structured prediction cards grounded in your current exposure, bankroll, and betting history.",
    quickPrompts: [
      "Build a prediction card for the strongest edge in my current profile.",
      "Give me a cautious pick with tight bankroll discipline.",
      "What is the highest-confidence angle based on my recent segment results?",
      "Create a contrarian pick only if my history supports it.",
    ],
    systemFocus: [
      "Return a structured pick card grounded in the user data context instead of vague narrative advice.",
      "Use conservative confidence and stake sizing when the evidence is thin or mixed.",
    ],
  },
  {
    mode: "bankroll",
    label: "Bankroll Coach",
    badge: "Risk",
    description: "Focuses on stake sizing, drawdown control, exposure balance, and tilt prevention.",
    inputPlaceholder: "Ask about risk, staking, or bankroll protection...",
    emptyState: "Use this agent for bankroll discipline: stake sizing, drawdown control, open exposure balance, and tilt prevention.",
    quickPrompts: [
      "Audit my current open exposure and call out concentration risk.",
      "How aggressive is my recent stake sizing relative to results?",
      "Give me a bankroll protection plan for the next 7 days.",
      "What warning signs of tilt show up in my numbers?",
    ],
    systemFocus: [
      "Act as a bankroll coach focused on preservation, sizing discipline, variance management, and exposure control.",
      "Avoid speculative picks unless they directly support a risk-management recommendation.",
    ],
  },
  {
    mode: "recap",
    label: "Recap Writer",
    badge: "Review",
    description: "Turns recent activity into concise performance recaps and priority summaries.",
    inputPlaceholder: "Ask for a daily, weekly, or streak recap...",
    emptyState: "Use this agent for clean recap writing: recent performance, turning points, and what to carry into the next slate.",
    quickPrompts: [
      "Write a recap of my last 10 settled bets.",
      "Summarize my week with 3 wins, 3 mistakes, and 3 next actions.",
      "Give me a short postmortem on my most recent losses.",
      "Turn my current results into a locker-room style briefing.",
    ],
    systemFocus: [
      "Write concise recaps with clear takeaways, not generic motivation.",
      "Highlight inflection points, mistakes, strengths, and next priorities using the supplied data only.",
    ],
  },
  {
    mode: "watchlist",
    label: "Watchlist Scout",
    badge: "Scout",
    description: "Reviews tracked teams and segment trends to surface angles worth monitoring.",
    inputPlaceholder: "Ask about watchlist teams and spots to monitor...",
    emptyState: "Use this agent to inspect tracked teams, strong segments, and where your watchlist deserves more attention.",
    quickPrompts: [
      "Which watchlist teams deserve the most attention right now?",
      "What sports or segments are lining up with my strongest history?",
      "Where am I under-tracking information that could improve my watchlist?",
      "Build a scouting brief from my watchlist and recent bet performance.",
    ],
    systemFocus: [
      "Act as a scouting analyst that connects watchlist signals with the user's own segment performance.",
      "Do not invent schedules, injuries, or external news that is not present in the provided context.",
    ],
  },
];

export const SPECIALIST_ASSISTANT_AGENTS = ASSISTANT_AGENTS.filter(
  (agent): agent is AssistantAgentDefinition & { mode: SpecialistAssistantMode } => agent.mode !== "auto",
);

export function isAssistantMode(value: unknown): value is AssistantMode {
  return ASSISTANT_AGENTS.some((agent) => agent.mode === value);
}

export function normalizeAssistantMode(value: unknown): AssistantMode {
  return isAssistantMode(value) ? value : "default";
}

export function getAssistantAgent(mode: unknown): AssistantAgentDefinition {
  const normalizedMode = normalizeAssistantMode(mode);
  return ASSISTANT_AGENTS.find((agent) => agent.mode === normalizedMode) ?? ASSISTANT_AGENTS[0];
}

export function isSpecialistAssistantMode(value: unknown): value is SpecialistAssistantMode {
  return SPECIALIST_ASSISTANT_AGENTS.some((agent) => agent.mode === value);
}

export function normalizeSpecialistAssistantMode(value: unknown): SpecialistAssistantMode {
  return isSpecialistAssistantMode(value) ? value : "default";
}