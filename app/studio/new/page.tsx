import { requireTeacher } from "@/lib/auth";
import { Placeholder } from "@/components/placeholder";
import { ServiceForm } from "@/components/service-form";

export default async function NewService() {
  await requireTeacher();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-serif text-3xl">New lesson</h1>
      <ServiceForm />
      <Placeholder title="Real video hosting" action="Upload video">
        Direct uploads to Mux or Cloudflare Stream with signed HLS playback, and the teaser auto-cut from the first 15
        seconds. For the MVP, paste public MP4 URLs.
      </Placeholder>
    </div>
  );
}
