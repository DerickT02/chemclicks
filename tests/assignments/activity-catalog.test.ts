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
  it("retrieves deterministic metadata while retaining retired rows for existing assignment labels", async () => {
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
        description: "Ruler exploration; the 0.1 cm reporting update is pending",
        category: "Measurement",
      },
      {
        ...activities[1],
        description: "Retired ruler offering; use the single tenths experience after its precision update",
        category: "Measurement",
      },
    ]);
  });

  it("labels unknown database types as unavailable rather than exposing missing descriptions", async () => {
    const activity = { id: "future", title: "Future activity", type: "future_activity", order_index: 1 } as unknown as Activity;
    const { client } = catalogClient({ data: [activity], error: null });
    expect(await listActivityCatalog(client)).toEqual({
      data: [{ ...activity, description: "This activity is not supported yet.", category: "Unavailable" }],
      error: null,
    });
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
