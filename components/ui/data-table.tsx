import { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
};

export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div className="no-scrollbar overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="border-b border-[color:var(--outline-variant)]/24 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--on-surface-variant)]"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-[color:var(--outline-variant)]/16 last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className={`px-3 py-3 text-sm text-[color:var(--on-surface)] ${column.className ?? ""}`.trim()}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
