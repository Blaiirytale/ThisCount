// Business days = Monday to Friday (Taiwan public holidays are not counted here)

export const APPROVAL_MIN_DAYS = 2;
export const APPROVAL_MAX_DAYS = 3;

export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const weekday = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return d;
}

// When an admin should decide by, e.g. submitted Thu → Mon to Tue
export function approvalWindow(submittedAt: string): { from: Date; to: Date } {
  const start = new Date(submittedAt);
  return { from: addBusinessDays(start, APPROVAL_MIN_DAYS), to: addBusinessDays(start, APPROVAL_MAX_DAYS) };
}

// Past the 3-business-day promise?
export function isOverdue(submittedAt: string, now = new Date()): boolean {
  return now > approvalWindow(submittedAt).to;
}
