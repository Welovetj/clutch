import type { Kpi } from "@/lib/models";

type KpiTileProps = {
  item: Kpi;
};

export function KpiTile({ item }: KpiTileProps) {
  return (
    <article className="panel p-4 sm:p-5">
      <p className="soft-label">{item.label}</p>
      <p className="metric mt-3 text-3xl font-semibold text-[color:var(--on-surface)]">{item.value}</p>
      <p className="mt-1 text-xs text-[color:var(--primary)]">{item.delta}</p>
    </article>
  );
}
