import type { RouteDraft, RoutePoint } from "./types";
import { routeNumbers } from "./routeEngine";
export const dayColors = [
  "#a74b35",
  "#356875",
  "#766237",
  "#69547b",
  "#396b50",
  "#9b4b68",
];
export function mapGeometry(route: RouteDraft, day?: number) {
  const numbers = routeNumbers(route),
    points: { point: RoutePoint; label: string }[] = [],
    lines: {
      points: { lat: number; lng: number }[];
      day: number;
      schematic: boolean;
      error: boolean;
      arrow: boolean;
    }[] = [];
  if (route.hotelAnchor) points.push({ point: route.hotelAnchor, label: "H" });
  for (const d of route.days.filter(
    (d) => day === undefined || d.day === day,
  )) {
    for (const leg of d.legs || []) {
      if (
        leg.to.id !== route.hotelAnchor?.id &&
        !points.some((p) => p.point.id === leg.to.id)
      )
        points.push({
          point: leg.to,
          label: String(numbers[leg.to.id] || "?"),
        });
      const actual = leg.status === "ready" && leg.polylines.length > 0;
      let segment = 0;
      for (const polyline of actual ? leg.polylines : [[leg.from, leg.to]])
        lines.push({
          points: polyline,
          day: d.day,
          schematic: !actual,
          error: leg.status !== "ready",
          arrow: !actual || ++segment === leg.polylines.length,
        });
    }
  }
  const mercator = (p: { lng: number; lat: number }) => ({
    x: (p.lng * Math.PI) / 180,
    y: Math.log(
      Math.tan(
        Math.PI / 4 + (Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 360,
      ),
    ),
  });
  const all = [
    ...points.map((p) => p.point),
    ...lines.flatMap((l) => l.points),
  ].map(mercator);
  const bounds = all.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p.x),
      maxX: Math.max(b.maxX, p.x),
      minY: Math.min(b.minY, p.y),
      maxY: Math.max(b.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const { minX, maxX, minY, maxY } = bounds;
  const dx = Math.max(maxX - minX, 0.00002),
    dy = Math.max(maxY - minY, 0.00002),
    scale = Math.min(760 / dx, 450 / dy),
    cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  const project = (p: { lng: number; lat: number }) => {
    const m = mercator(p);
    return { x: 450 + (m.x - cx) * scale, y: 300 - (m.y - cy) * scale };
  };
  return {
    points: points.map((p) => ({ ...p, ...project(p.point) })),
    lines: lines.map((l) => ({ ...l, points: l.points.map(project) })),
    hasSchematic: lines.some((l) => l.schematic),
    hasOfficialGeometry: route.days.some((d) =>
      d.legs?.some((l) => l.geometrySource?.includes("官方路径")),
    ),
  };
}
