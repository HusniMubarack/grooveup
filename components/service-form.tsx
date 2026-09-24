"use client";

import { useActionState } from "react";
import { createServiceAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { TYPE_LABELS } from "@/lib/categories";
import { LEVELS, STYLES, TYPES } from "@/lib/utils";

const SAMPLE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1"><Label>{label}</Label>{children}</div>;
}
function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-[var(--primary)]" /> {label}
    </label>
  );
}

export function ServiceForm() {
  const [state, action, pending] = useActionState(createServiceAction, undefined);
  // After a validation error React resets the form; these defaults put the user's input back.
  const sent = state?.values;
  const v = (name: string, fallback: string | number) => sent?.[name] ?? String(fallback);
  const on = (name: string, fallback: boolean) => (sent ? sent[name] === "on" : fallback);
  return (
    <form key={JSON.stringify(sent ?? {})} action={action} className="grid gap-4 rounded-xl border bg-card p-4">
      <Field label="Title"><Input name="title" required placeholder="Popping 101: Hits & Waves" defaultValue={v("title", "")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select name="type" defaultValue={v("type", "STEP")}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</Select></Field>
        <Field label="Level"><Select name="level" defaultValue={v("level", "BEGINNER")}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></Field>
        <Field label="Style"><Select name="style" defaultValue={v("style", "Hip-Hop")}>{STYLES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Duration (min : sec)">
          <div className="grid grid-cols-2 gap-2">
            <Input name="durationMin" type="number" min={0} max={20} defaultValue={v("durationMin", 1)} aria-label="Minutes" />
            <Input name="durationSec" type="number" min={0} max={59} defaultValue={v("durationSec", 0)} aria-label="Seconds" />
          </div>
        </Field>
      </div>
      <Field label="Description"><Textarea name="description" placeholder="What will students be able to do after this lesson?" defaultValue={v("description", "")} /></Field>
      <Field label="Teaser URL (MP4)"><Input name="teaserUrl" type="url" required defaultValue={v("teaserUrl", `${SAMPLE}/ForBiggerBlazes.mp4`)} /></Field>
      <Field label="Video URL (MP4)"><Input name="videoUrl" type="url" required defaultValue={v("videoUrl", `${SAMPLE}/ForBiggerFun.mp4`)} /></Field>
      <Field label="Thumbnail URL"><Input name="thumbnailUrl" type="url" defaultValue={v("thumbnailUrl", `${SAMPLE}/images/ForBiggerFun.jpg`)} /></Field>
      <Field label="Price (₹, one-time; 0 = not sold separately)"><Input name="priceRupees" type="number" min={0} step={1} defaultValue={v("priceRupees", 0)} /></Field>
      <div className="grid gap-2">
        <Check name="includedInSub" label="Included in my course subscription (always on for course lessons)" defaultChecked={on("includedInSub", true)} />
        <Check name="isFree" label="Free for everyone" defaultChecked={on("isFree", false)} />
      </div>
      <fieldset className="grid gap-2">
        <Label>Sections (seconds)</Label>
        {[1, 2].map((n) => (
          <div key={n} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
            <Input name={`s${n}label`} placeholder={n === 1 ? "Breakdown" : "Full speed"} defaultValue={v(`s${n}label`, n === 1 ? "Breakdown" : "Full speed")} />
            <Input name={`s${n}start`} type="number" min={0} defaultValue={v(`s${n}start`, n === 1 ? 0 : 30)} aria-label="Start sec" />
            <Input name={`s${n}end`} type="number" min={0} defaultValue={v(`s${n}end`, n === 1 ? 30 : 60)} aria-label="End sec" />
          </div>
        ))}
      </fieldset>
      <Check name="published" label="Publish now" defaultChecked={on("published", true)} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button size="lg" disabled={pending}>Create lesson</Button>
    </form>
  );
}
