import { payAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/utils";

/** "Pay ₹X (mock)" — posts to the single mock pay action. No card form. */
export function PayButton({ kind, id, amountPaise, back, label }: { kind: "SUBSCRIPTION" | "SERVICE"; id: string; amountPaise: number; back: string; label?: string }) {
  return (
    <form action={payAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <Button className="w-full" variant={kind === "SERVICE" ? "default" : "outline"}>
        {label ? `${label} · ` : ""}Pay {rupees(amountPaise)} (mock)
      </Button>
    </form>
  );
}
