export type ReadError = { code: string; message: string };
export type ReadResult<T> = { data: T[] | null; error: ReadError | null };

const PAGE_SIZE = 100;

/** Stable ordering is required by the caller. Never return partial counts on failure. */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<ReadResult<T>>,
): Promise<ReadResult<T>> {
  const rows: T[] = [];
  try {
    for (let offset = 0; ; ) {
      const { data, error } = await fetchPage(offset, offset + PAGE_SIZE - 1);
      if (error) return { data: null, error };
      if (!Array.isArray(data)) break;
      if (data.length === 0) return { data: rows, error: null };
      rows.push(...data);
      // Follow actual rows returned, including backend caps smaller than PAGE_SIZE.
      offset += data.length;
    }
  } catch {
    // Do not expose transport/configuration details or treat them as an empty list.
  }
  return { data: null, error: { code: "READ_FAILED", message: "Data could not be loaded. Please refresh the page." } };
}
