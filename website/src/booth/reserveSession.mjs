// Reservation retries reuse the same idempotency key; business errors need user action.
export async function reserveSession(request, active = () => true, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const first = await request();
  const code = first.error?.code;
  const transient = first.error && (first.status === 0 || first.status >= 500 || ['40001', '40P01', 'PGRST000', 'PGRST001', 'PGRST002'].includes(code));
  if (!transient || ['P0001', '42501', 'PGRST202'].includes(code)) return first;
  await wait(400);
  if (!active()) throw new Error('This session has ended.');
  return request();
}
