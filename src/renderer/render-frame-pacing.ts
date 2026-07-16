export const MAX_RENDER_FRAME_RATE = 120;

const FRAME_INTERVAL_MS = 1000 / MAX_RENDER_FRAME_RATE;
const DEADLINE_TOLERANCE_MS = 0.5;

export function nextRenderDeadline(timestamp: number, deadline: number): number | null {
  if (timestamp + DEADLINE_TOLERANCE_MS < deadline) return null;
  const next = deadline + FRAME_INTERVAL_MS;
  return timestamp - next >= FRAME_INTERVAL_MS ? timestamp + FRAME_INTERVAL_MS : next;
}
