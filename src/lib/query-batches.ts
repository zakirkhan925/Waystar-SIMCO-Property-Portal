/** Read a stable, uniquely ordered query past the API's per-request row limit. */
export async function readBatches<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const size = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await load(from, from + size - 1);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    if (data.length < size) return rows;
  }
}
