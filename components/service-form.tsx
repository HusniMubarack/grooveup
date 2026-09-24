"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Service, ServiceSection } from "@prisma/client";
import { createServiceAction, updateServiceAction, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { VideoUpload } from "@/components/video-upload";
import { MAX_SECTIONS, TYPE_LABELS } from "@/lib/categories";
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

type Initial = Record<string, string>;

/** Form values for a new lesson, or for editing an existing one. */
function initialValues(s?: Service & { sections: ServiceSection[] }, muxEnabled?: boolean): Initial {
  if (!s)
    return {
      type: "STEP", level: "BEGINNER", style: "Hip-Hop", durationMin: "1", durationSec: "0", priceRupees: "0",
      // With Mux, teachers upload instead of pasting links.
      teaserUrl: muxEnabled ? "" : `${SAMPLE}/ForBiggerBlazes.mp4`,
      videoUrl: muxEnabled ? "" : `${SAMPLE}/ForBiggerFun.mp4`,
      thumbnailUrl: muxEnabled ? "" : `${SAMPLE}/images/ForBiggerFun.jpg`,
      includedInSub: "on", published: "on",
      s1label: "Breakdown", s1start: "0", s1end: "30", s2label: "Full speed", s2start: "30", s2end: "60",
    };
  const v: Initial = {
    title: s.title, type: s.type, level: s.level, style: s.style, description: s.description,
    durationMin: String(Math.floor(s.durationSec / 60)), durationSec: String(s.durationSec % 60),
    teaserUrl: s.teaserUrl, videoUrl: s.videoUrl, thumbnailUrl: s.thumbnailUrl,
    priceRupees: String(s.pricePaise / 100), muxUploadId: s.muxUploadId ?? "",
  };
  if (s.includedInSub) v.includedInSub = "on";
  if (s.isFree) v.isFree = "on";
  if (s.published) v.published = "on";
  s.sections.forEach((sec, i) => {
    v[`s${i + 1}label`] = sec.label;
    v[`s${i + 1}start`] = String(sec.startSec);
    v[`s${i + 1}end`] = String(sec.endSec);
  });
  return v;
}

const sectionCount = (v: Initial) => Math.max(1, ...Array.from({ length: MAX_SECTIONS }, (_, i) => (v[`s${i + 1}label`] ? i + 1 : 0)));

export function ServiceForm({ service, muxEnabled }: { service?: Service & { sections: ServiceSection[] }; muxEnabled: boolean }) {
  const submit = service ? updateServiceAction.bind(null, service.id) : createServiceAction;
  const [state, action, pending] = useActionState<FormState, FormData>(submit, undefined);
  // After a validation error React resets the form; the sent values (or the lesson) become the defaults.
  const values = state?.values ?? initialValues(service, muxEnabled);
  return <FormBody key={JSON.stringify(values)} values={values} action={action} pending={pending} error={state?.error} service={service} muxEnabled={muxEnabled} />;
}

function FormBody({ values, action, pending, error, service, muxEnabled }: {
  values: Initial; action: (f: FormData) => void; pending: boolean; error?: string;
  service?: Service; muxEnabled: boolean;
}) {
  const v = (name: string) => values[name] ?? "";
  const [rows, setRows] = useState(sectionCount(values));
  const usesMux = muxEnabled || !!service?.muxUploadId;

  return (
    <form action={action} className="grid gap-4 rounded-xl border bg-card p-4">
      <Field label="Title"><Input name="title" required placeholder="Popping 101: Hits & Waves" defaultValue={v("title")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select name="type" defaultValue={v("type")}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</Select></Field>
        <Field label="Level"><Select name="level" defaultValue={v("level")}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></Field>
        <Field label="Style"><Select name="style" defaultValue={v("style")}>{STYLES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Duration (min : sec)">
          <div className="grid grid-cols-2 gap-2">
            <Input name="durationMin" type="number" min={0} max={20} defaultValue={v("durationMin")} aria-label="Minutes" />
            <Input name="durationSec" type="number" min={0} max={59} defaultValue={v("durationSec")} aria-label="Seconds" />
          </div>
        </Field>
      </div>
      <Field label="Description"><Textarea name="description" placeholder="What will students be able to do after this lesson?" defaultValue={v("description")} /></Field>

      {usesMux && (
        <Field label="Lesson video">
          <VideoUpload initialUploadId={v("muxUploadId") || null} status={service?.videoStatus} />
        </Field>
      )}
      <Field label={usesMux ? "…or paste a video link (MP4)" : "Video URL (MP4)"}><Input name="videoUrl" type="url" defaultValue={v("videoUrl")} /></Field>
      <Field label="Teaser URL (MP4, optional)"><Input name="teaserUrl" type="url" defaultValue={v("teaserUrl")} /></Field>
      <Field label="Thumbnail URL (optional)"><Input name="thumbnailUrl" type="url" defaultValue={v("thumbnailUrl")} /></Field>
      <Field label="Price (₹, one-time; 0 = not sold separately)"><Input name="priceRupees" type="number" min={0} step={1} defaultValue={v("priceRupees")} /></Field>
      <div className="grid gap-2">
        <Check name="includedInSub" label="Included in my course subscription (always on for course lessons)" defaultChecked={values.includedInSub === "on"} />
        <Check name="isFree" label="Free for everyone" defaultChecked={values.isFree === "on"} />
      </div>

      <fieldset className="grid gap-2">
        <Label>Sections: practice points students can jump to and loop (seconds)</Label>
        {Array.from({ length: rows }, (_, i) => i + 1).map((n) => (
          <div key={n} className="grid grid-cols-[1fr_4rem_4rem_2rem] gap-2">
            <Input name={`s${n}label`} placeholder={`Section ${n}`} defaultValue={v(`s${n}label`)} aria-label={`Section ${n} name`} />
            <Input name={`s${n}start`} type="number" min={0} defaultValue={v(`s${n}start`)} aria-label="Start sec" placeholder="from" />
            <Input name={`s${n}end`} type="number" min={0} defaultValue={v(`s${n}end`)} aria-label="End sec" placeholder="to" />
            {n === rows && rows > 1 ? (
              <button type="button" onClick={() => setRows(rows - 1)} aria-label="Remove section" className="grid place-items-center text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
            ) : <span />}
          </div>
        ))}
        {rows < MAX_SECTIONS && (
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setRows(rows + 1)}><Plus /> Add section</Button>
        )}
      </fieldset>

      {service?.unpublishedByAdmin ? (
        <p className="text-sm text-destructive">Removed by admin: {service.unpublishedReason}. It stays unpublished until an admin restores it.</p>
      ) : (
        <Check name="published" label={service ? "Published" : "Publish now"} defaultChecked={values.published === "on"} />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="lg" disabled={pending}>{service ? "Save changes" : "Create lesson"}</Button>
    </form>
  );
}
