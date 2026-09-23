import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  listActivityCatalog,
  type Activity,
} from "@/lib/db/activities";

function catalogClient(result: {
  data: Activity[] | null;
  error: { code: string; message: string } | null;
}) {
  const order = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  const query = { order, select };

  from.mockReturnValue(query);
  select.mockReturnValue(query);
  order.mockReturnValueOnce(query).mockResolvedValueOnce(result);

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    order,
  };
}

describe("activity catalog retrieval", () => {
  it("retrieves entries in deterministic display order with distinguishing metadata", async () => {
    const activities: Activity[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Ruler Practice",
        type: "measurement_ruler_tenths",
        order_index: 1,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Ruler Practice",
        type: "measurement_ruler_hundredths",
        order_index: 1,
      },
    ];
    const { client, from, select, order } = catalogClient({
      data: activities,
      error: null,
    });

    const result = await listActivityCatalog(client);

    expect(from).toHaveBeenCalledWith("activities");
    expect(select).toHaveBeenCalledWith("id, title, type, order_index");
    expect(order).toHaveBeenNthCalledWith(1, "order_index", { ascending: true });
    expect(order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        ...activities[0],
        description: "Practice ruler measurements to the nearest tenth",
      },
      {
        ...activities[1],
        description: "Practice ruler measurements to the nearest hundredth",
      },
    ]);
  });

  it("returns an explicit empty catalog", async () => {
    const { client } = catalogClient({ data: [], error: null });

    await expect(listActivityCatalog(client)).resolves.toEqual({
      data: [],
      error: null,
    });
  });

  it("returns database errors without exposing partial catalog data", async () => {
    const error = { code: "DATABASE_ERROR", message: "query failed" };
    const { client } = catalogClient({ data: null, error });

    await expect(listActivityCatalog(client)).resolves.toEqual({
      data: null,
      error,
    });
  });
});
