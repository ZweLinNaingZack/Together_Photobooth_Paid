export async function connectionRetry(request, stopped = () => false, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (stopped()) return null;
    try { return await request(); }
    catch (error) {
      if (stopped()) return null;
      const retryable = !error.status || [409,429,500,502,503,504].includes(error.status);
      if (!retryable || attempt === 2) throw error;
      await wait(error.status === 429 ? 5000 : 750 * (attempt + 1));
    }
  }
}
