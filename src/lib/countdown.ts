export function countdownDays(tripStart: string, now = new Date()): number {
  const dep = new Date(`${tripStart}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((dep - now.getTime()) / 86400000));
}
