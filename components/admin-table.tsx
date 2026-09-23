import { cn } from "@/lib/utils";

export type Column<T> = { h: string; cell: (row: T) => React.ReactNode; className?: string };

/** The one admin table: dense, horizontally scrollable on small screens. */
export function AdminTable<T extends { id: string }>({ columns, rows, highlight, empty = "Nothing here." }: { columns: Column<T>[]; rows: T[]; highlight?: (row: T) => boolean; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>{columns.map((c) => <th key={c.h} className={cn("whitespace-nowrap px-2 py-2 font-medium", c.className)}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length} className="px-2 py-6 text-center text-muted-foreground">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={cn("border-t align-top hover:bg-muted/30", highlight?.(r) && "bg-primary/10")}>
              {columns.map((c) => <td key={c.h} className={cn("px-2 py-2", c.className)}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tiny inline form button for admin mutations. */
export function ActionButton({ action, fields, children, variant = "secondary" }: { action: (f: FormData) => Promise<void>; fields: Record<string, string>; children: React.ReactNode; variant?: "secondary" | "destructive" | "primary" }) {
  return (
    <form action={action} className="inline">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button
        className={cn(
          "h-7 whitespace-nowrap rounded px-2 text-[11px] font-medium",
          variant === "destructive" && "bg-destructive/90 text-white hover:bg-destructive",
          variant === "secondary" && "bg-secondary hover:bg-secondary/70",
          variant === "primary" && "bg-primary text-primary-foreground",
        )}
      >
        {children}
      </button>
    </form>
  );
}
