import type { TeacherProfile } from "@prisma/client";
import { requestState, upiInfo } from "./requests";
import { timeAgo } from "./utils";

/** Server-side props for <RequestAccess>: payment details + any pending request. */
export async function requestPanel(studentId: string, teacher: TeacherProfile, teacherName: string, serviceId: string | null, amountPaise: number, item: string) {
  const [state, upi] = await Promise.all([requestState(studentId, teacher.id, serviceId), upiInfo(teacher, teacherName, amountPaise, item)]);
  return {
    hasAccess: state.hasAccess,
    upi,
    pending: state.pending ? { id: state.pending.id, sentAgo: timeAgo(state.pending.createdAt), paymentRef: state.pending.paymentRef } : null,
  };
}
