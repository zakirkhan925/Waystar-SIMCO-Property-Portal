import type { NextRequest } from "next/server";
import { parseUnitFilters } from "@/features/units/filters";
import { listUnitsAll } from "@/features/units/queries";
import { getProject } from "@/features/projects/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { CATEGORY_LABELS, UNIT_STATUS_LABELS } from "@/lib/labels";
import { todayPK } from "@/lib/dates";

/** CSV of the filtered inventory (RLS applies — users only export what they can see). */
export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const projectId = sp.projectId;
  if (!projectId) return new Response("projectId is required", { status: 400 });

  const project = await getProject(projectId);
  if (!project) return new Response("Not found", { status: 404 });

  const units = await listUnitsAll(projectId, parseUnitFilters(sp), 10000);
  const csv = toCsv(
    ["Project", "Block/Tower", "Street", "Floor", "Unit No", "Category", "Use", "Size", "Size Unit", "Area (sq ft)",
     "Bedrooms", "Corner", "Park Facing", "Main Boulevard", "Base Price (PKR)", "Price per sq ft (PKR)", "Status"],
    units.map((u) => [
      project.name, u.blocks?.name, u.street, u.floors?.label, u.unit_no, CATEGORY_LABELS[u.category], u.use,
      Number(u.size_value), u.size_unit, Number(u.area_sqft), u.bedrooms,
      u.is_corner ? "Yes" : "No", u.is_park_facing ? "Yes" : "No", u.is_main_boulevard ? "Yes" : "No",
      Number(u.base_price), u.price_per_sqft === null ? null : Number(u.price_per_sqft), UNIT_STATUS_LABELS[u.status],
    ]),
  );
  return csvResponse(`${project.code}-inventory-${todayPK()}.csv`, csv);
}
