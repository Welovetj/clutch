import { AssistantPanel } from "@/components/shell/assistant-panel";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { StatusStrip } from "@/components/shell/status-strip";
import { Topbar } from "@/components/shell/topbar";
import { EvCalculatorFloat } from "@/components/shell/ev-calculator-float";
import type { LiveUpdate } from "@/lib/models";

type AppShellProps = {
  children: React.ReactNode;
  statusItems: LiveUpdate[];
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
};

export function AppShell({ children, statusItems, user }: AppShellProps) {
  return (
    <div className="terminal-shell min-h-screen pb-24">
      <LiveRefresh />
      <AssistantPanel />
      <EvCalculatorFloat />
      <Topbar user={user} />
      <div className="app-section min-w-0 px-4 py-6 sm:px-6">{children}</div>
      <StatusStrip items={statusItems} />
    </div>
  );
}
