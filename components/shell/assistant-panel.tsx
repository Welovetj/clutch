"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, MessageSquareText, SendHorizontal, Sparkles, Target, Trash2, X } from "lucide-react";

type AssistantMessage = {
  id?: string;
  role: "user" | "assistant";
  mode?: "default" | "prediction";
  content: string;
  prediction?: {
    title: string;
    pick: string;
    confidence: number;
    rationale: string[];
    riskFlags: string[];
    recommendedStakePct: number;
    timeHorizon: string;
  } | null;
};

const quickPrompts = [
  "Summarize my recent bets into short notes.",
  "What patterns do you see in my ROI by segment?",
  "Give 3 risk-control insights from my bankroll and open exposure.",
  "What should I focus on this week based on my betting history?",
];

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [predictionMode, setPredictionMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch("/api/ai/history", { method: "GET" });
        const payload = (await response.json()) as {
          data?: Array<{
            id?: string;
            role?: "user" | "assistant";
            mode?: "default" | "prediction";
            content?: string;
            prediction?: AssistantMessage["prediction"];
          }>;
        };

        if (!response.ok || !Array.isArray(payload.data)) {
          return;
        }

        setMessages(
          payload.data
            .filter(
              (item): item is NonNullable<typeof payload.data>[number] =>
                (item?.role === "user" || item?.role === "assistant") && typeof item?.content === "string",
            )
            .map((item) => ({
              id: item.id,
              role: item.role!,
              mode: item.mode,
              content: item.content!,
              prediction: item.prediction ?? null,
            })),
        );
      } catch {
        // Ignore transient history loading errors.
      }
    }

    void loadHistory();
  }, []);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendMessage(content: string, mode: "default" | "prediction" = predictionMode ? "prediction" : "default") {
    const message = content.trim();
    if (!message || loading) {
      return;
    }

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", mode, content: message }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          mode,
          history: nextMessages.slice(-12),
        }),
      });

      const data = (await response.json()) as {
        data?: {
          reply?: string;
          predictionCard?: AssistantMessage["prediction"];
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Assistant request failed");
      }

      const reply = data.data?.reply?.trim();
      if (!reply) {
        throw new Error("Assistant returned an empty reply");
      }

      setMessages((current) => [...current, { role: "assistant", mode, content: reply, prediction: data.data?.predictionCard ?? null }]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Assistant request failed");
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    try {
      setError(null);
      const response = await fetch("/api/ai/history", { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to clear chat history");
      }
      setMessages([]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to clear chat history");
    }
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full border border-[color:var(--outline-variant)]/25 bg-[color:var(--surface-high)] px-4 py-2 text-sm text-[color:var(--primary)] shadow-sm"
          aria-label="Open AI assistant"
        >
          <Sparkles className="h-4 w-4" />
          AI Assistant
        </button>
      ) : null}

      {open ? (
        <aside className="fixed bottom-24 right-5 z-30 flex h-[70vh] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[color:var(--outline-variant)]/25 bg-[color:var(--surface)]">
          <header className="flex items-center gap-2 border-b border-[color:var(--outline-variant)]/20 px-4 py-3">
            <Bot className="h-4 w-4 text-[color:var(--primary)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[color:var(--on-surface)]">Clutch AI</p>
              <p className="text-[10px] text-[color:var(--on-surface-variant)]">Server-synced history, analytics Q&A, and predictions</p>
            </div>
            <button type="button" onClick={() => void clearHistory()} className="rounded p-1 text-[color:var(--on-surface-variant)]" aria-label="Clear chat history" title="Clear chat history">
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-[color:var(--on-surface-variant)]" aria-label="Close assistant">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
            {!messages.length ? (
              <div className="panel-high p-3 text-xs text-[color:var(--on-surface-variant)]">
                Ask about your live betting history. Examples: summarize bet notes, explain ROI segments, or generate risk-control insights.
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div key={message.id ?? `${message.role}-${index}`} className="space-y-2">
                <div
                  className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${message.role === "assistant" ? "bg-[color:var(--surface-lowest)] text-[color:var(--on-surface)]" : "bg-[color:var(--surface-high)] text-[color:var(--primary)]"}`}
                >
                  {message.content}
                </div>
                {message.role === "assistant" && message.prediction ? (
                  <div className="panel-high space-y-2 rounded-xl p-3 text-xs">
                    <div className="flex items-center gap-2 text-[color:var(--primary)]">
                      <Target className="h-3.5 w-3.5" />
                      <span className="font-semibold">{message.prediction.title}</span>
                    </div>
                    <p className="text-sm text-[color:var(--on-surface)]">{message.prediction.pick}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="soft-label">Confidence</p>
                        <p className="metric text-[color:var(--primary)]">{message.prediction.confidence.toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className="soft-label">Stake</p>
                        <p className="metric text-[color:var(--on-surface)]">{message.prediction.recommendedStakePct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <p className="text-[color:var(--on-surface-variant)]">{message.prediction.timeHorizon}</p>
                    {message.prediction.rationale.length ? (
                      <ul className="space-y-1 text-[color:var(--on-surface-variant)]">
                        {message.prediction.rationale.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {message.prediction.riskFlags.length ? (
                      <div className="space-y-1 text-[color:var(--error)]">
                        {message.prediction.riskFlags.map((item) => (
                          <p key={item}>Risk: {item}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="flex items-center gap-2 rounded-xl bg-[color:var(--surface-lowest)] px-3 py-2 text-xs text-[color:var(--on-surface-variant)]">
                <MessageSquareText className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                Thinking with your live data...
              </div>
            ) : null}

            {error ? <p className="text-xs text-[color:var(--error)]">{error}</p> : null}
          </div>

          <div className="border-t border-[color:var(--outline-variant)]/20 p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPredictionMode((current) => !current)}
                className={`rounded-full border px-2.5 py-1 text-[10px] ${predictionMode ? "border-[color:var(--primary)]/50 text-[color:var(--primary)]" : "border-[color:var(--outline-variant)]/25 text-[color:var(--on-surface-variant)]"}`}
                disabled={loading}
              >
                Prediction Mode {predictionMode ? "On" : "Off"}
              </button>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt, predictionMode ? "prediction" : "default")}
                  className="rounded-full border border-[color:var(--outline-variant)]/25 px-2.5 py-1 text-[10px] text-[color:var(--on-surface-variant)]"
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(input);
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about notes, trends, or insights..."
                className="min-h-20 flex-1 resize-none rounded-xl border border-[color:var(--outline-variant)]/25 bg-[color:var(--surface-lowest)] px-3 py-2 text-sm outline-none"
              />
              <button type="submit" title="Send message" aria-label="Send message" className="btn-primary h-10 px-3" disabled={!canSend}>
                <SendHorizontal className="h-4 w-4" />
              </button>
            </form>
          </div>
        </aside>
      ) : null}
    </>
  );
}
