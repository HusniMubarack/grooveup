import { requireTeacher } from "@/lib/auth";
import { muxEnabled } from "@/lib/mux";
import { ServiceForm } from "@/components/service-form";

export default async function NewService() {
  await requireTeacher();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-serif text-3xl">New lesson</h1>
      <ServiceForm muxEnabled={muxEnabled()} />
    </div>
  );
}
