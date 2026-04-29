/**
 * Fails a DB promise with a clear error if it does not settle within `ms` (Vercel/TiDB hang guard).
 */
export function withDbTimeout<T>(promise: Promise<T>, ms: number, label = "db"): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  return new Promise<T>((resolve, reject) => {
    t = setTimeout(() => {
      t = null;
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        if (t) clearTimeout(t);
        t = null;
        resolve(v);
      },
      (e) => {
        if (t) clearTimeout(t);
        t = null;
        reject(e);
      },
    );
  });
}
