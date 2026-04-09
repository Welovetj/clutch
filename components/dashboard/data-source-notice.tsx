type DataSourceNoticeProps = {
  source: "supabase" | "schema-missing";
};

export function DataSourceNotice({ source }: DataSourceNoticeProps) {
  if (source === "supabase") {
    return null;
  }

  return (
    <div className="panel-high mb-4 p-3 text-sm text-[color:var(--on-surface-variant)]">
      Supabase tables are not available yet. Your dashboard is staying empty by design. Run the SQL in supabase/schema.sql, then refresh to enable saved data.
    </div>
  );
}
