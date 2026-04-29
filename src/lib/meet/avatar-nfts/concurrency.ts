/**
 * Bounded parallel mapping — avoids unbounded Promise.all on large sets.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length));

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
