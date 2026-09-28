/**
 * In-app payments: NOT live yet. Today a teacher or an admin approves each access request by hand.
 *
 * Plan: a PaymentProvider (Razorpay first, then Stripe) creates a checkout for an AccessRequest. When
 * the provider confirms payment (webhook), call `grantAccess(request, until, "payment", provider.name)`
 * from lib/grant.ts, the exact same unlock the manual approval uses, and record the split below.
 */
import type { AccessRequest } from "@prisma/client";

/** Platform's share of each payment; the rest is paid out to the teacher. */
export const PLATFORM_FEE_PERCENT = 10;

export function splitPayment(amountPaise: number) {
  const platformPaise = Math.round((amountPaise * PLATFORM_FEE_PERCENT) / 100);
  return { platformPaise, teacherPaise: amountPaise - platformPaise };
}

export interface PaymentProvider {
  name: "RAZORPAY" | "STRIPE";
  /** Returns a URL (or client token) that sends the student to pay for this request. */
  createCheckout(request: AccessRequest): Promise<{ checkoutUrl: string }>;
  /** Verifies a webhook and returns the request it paid for, or null if it isn't a successful payment. */
  verifyWebhook(req: Request): Promise<{ requestId: string; amountPaise: number } | null>;
}
