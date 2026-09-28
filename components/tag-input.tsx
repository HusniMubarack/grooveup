"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { COMMON_TAGS, MAX_TAGS, MIN_TAGS, normalizeTag, TAG_SUGGESTIONS } from "@/lib/tags";
import { cn } from "@/lib/utils";

/** Chip-style tag input: Enter or comma adds, × removes, suggestions follow the lesson's style. */
export function TagInput({ initial, style }: { initial: string[]; style: string }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) setTags([...tags, t]);
    setDraft("");
  };
  const suggestions = [...(TAG_SUGGESTIONS[style] ?? []), ...COMMON_TAGS].filter((t) => !tags.includes(t)).slice(0, 8);
  const short = MIN_TAGS - tags.length;

  return (
    <div className="grid gap-2">
      <input type="hidden" name="tags" value={JSON.stringify(tags)} />
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-muted/40 px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
            #{t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}><X className="size-3" /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && tags.length) setTags(tags.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={tags.length ? "" : "Type a tag and press Enter"}
          aria-label="Add a tag"
          className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions.map((t) => (
          <button key={t} type="button" onClick={() => add(t)} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary">
            + {t}
          </button>
        ))}
      </div>
      <p className={cn("text-[11px]", short > 0 ? "text-primary" : "text-muted-foreground")}>
        {short > 0 ? `Add ${short} more tag${short === 1 ? "" : "s"} (at least ${MIN_TAGS}) so students can find this lesson.` : `${tags.length}/${MAX_TAGS} tags`}
      </p>
    </div>
  );
}
