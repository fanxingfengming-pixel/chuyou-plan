import { ensureCorePlace } from "./model";
import type { RouteDraft, RouteStop, TripDraft } from "./types";
import { distanceKm } from "./services";
export function generateRoute(d: TripDraft, optimize = true): RouteDraft {
  const places = [...(ensureCorePlace(d)?.tripPlaces || d.tripPlaces)],
    ordered: typeof places = [];
  let anchor = d.selectedHotel || places[0];
  while (places.length) {
    if (anchor && optimize)
      places.sort(
        (a, b) =>
          (distanceKm(anchor!, a) ?? Infinity) -
          (distanceKm(anchor!, b) ?? Infinity),
      );
    const place = places.shift()!;
    ordered.push(place);
    anchor = place;
  }
  const count = Math.max(1, d.tripDays),
    perDay = Math.ceil(ordered.length / count);
  const periods: RouteStop["period"][] =
    d.localTransportPreference === "打车"
      ? ["早上", "下午", "晚上"]
      : ["早上", "下午", "下午", "晚上"];
  return {
    schemaVersion: 21,
    status: "idle",
    days: Array.from({ length: count }, (_, i) => {
      const selected = ordered.slice(i * perDay, (i + 1) * perDay);
      const stops: RouteStop[] = selected.map((p, j) => ({
        id: p.id,
        placeId: p.id,
        name: p.name,
        kind: "place",
        period: periods[Math.min(j, periods.length - 1)],
      }));
      if (stops.length)
        stops.splice(1, 0, {
          id: "meal-" + i,
          name: "附近用餐 · 自由选择",
          kind: "meal",
          period: "中午",
        });
      return { day: i + 1, stops };
    }),
    needsOptimization: false,
    generatedAt: new Date().toISOString(),
  };
}
export function moveStop(
  route: RouteDraft,
  id: string,
  day: number,
  beforeId?: string,
): RouteDraft {
  let stop: RouteStop | undefined;
  const days = route.days.map((d) => ({
    ...d,
    stops: d.stops.filter((s) => {
      if (s.id === id) {
        stop = s;
        return false;
      }
      return true;
    }),
  }));
  const target = days.find((d) => d.day === day);
  if (!stop || !target) return route;
  const index = beforeId
    ? target.stops.findIndex((s) => s.id === beforeId)
    : -1;
  target.stops.splice(index < 0 ? target.stops.length : index, 0, stop);
  return invalidateRoute({ ...route, days, needsOptimization: true });
}
export function optimizeRoute(d: TripDraft): RouteDraft {
  if (!d.routeDraft) return generateRoute(d);
  // Preserve user-chosen days; only optimize the geographic order inside each day.
  return {
    ...d.routeDraft,
    days: d.routeDraft.days.map((day) => {
      const ids = day.stops
        .filter((s) => s.kind === "place")
        .map((s) => s.placeId);
      const sub = generateRoute({
        ...d,
        tripDays: 1,
        tripPlaces: d.tripPlaces.filter((p) => ids.includes(p.id)),
      });
      return {
        day: day.day,
        stops: sub.days[0].stops.map((s) =>
          s.kind === "meal" ? { ...s, id: "meal-" + day.day } : s,
        ),
      };
    }),
    needsOptimization: false,
    generatedAt: new Date().toISOString(),
  };
}

export function invalidateRoute(route: RouteDraft): RouteDraft {
  return {
    ...route,
    schemaVersion: 21,
    status: "idle",
    error: "",
    hotelChoices: [],
    days: route.days.map((day) => ({
      ...day,
      stops: normalizeDayStops(day.stops, day.day),
      legs: [],
    })),
  };
}
export function routeSignature(d: TripDraft) {
  if (!d.routeDraft) return "";
  return JSON.stringify({
    city: d.destinationCity,
    hotel: [
      d.selectedHotel?.id,
      d.selectedHotel?.name,
      d.selectedHotel?.amapPoiId,
    ],
    places: d.tripPlaces.map((p) => p.id),
    days: d.routeDraft.days.map((day) => ({
      day: day.day,
      stops: day.stops.map((s) => [s.id, s.placeId, s.kind, s.period]),
    })),
    preference: d.localTransportPreference,
    dates: [
      d.dateMode,
      d.departureDate,
      d.returnDate,
      d.fuzzyDateText,
      d.tripDays,
    ],
  });
}
export function routeNumbers(route: RouteDraft | null) {
  const numbers: Record<string, number> = {};
  let next = 1;
  for (const day of route?.days || [])
    for (const stop of day.stops)
      if (
        stop.kind === "place" &&
        stop.placeId &&
        numbers[stop.placeId] === undefined
      )
        numbers[stop.placeId] = next++;
  return numbers;
}
export function isRouteReady(d: TripDraft) {
  const r = d.routeDraft;
  if (
    !r ||
    r.schemaVersion !== 21 ||
    r.status !== "ready" ||
    !r.hotelAnchor ||
    !d.tripPlaces.length
  )
    return false;
  const arranged = r.days.flatMap((day) =>
    day.stops.filter((s) => s.kind === "place").map((s) => s.placeId),
  );
  if (
    arranged.length !== d.tripPlaces.length ||
    new Set(arranged).size !== arranged.length ||
    d.tripPlaces.some((p) => !arranged.includes(p.id))
  )
    return false;
  return (
    r.querySignature === routeSignature(d) &&
    r.days.length === d.tripDays &&
    r.days.every((day, index) => {
      const places = day.stops.filter((s) => s.kind === "place");
      if (day.day !== index + 1) return false;
      if (!places.length) return !day.legs?.length;
      const nodes = [
        r.hotelAnchor!.id,
        ...places.map((s) => s.placeId),
        r.hotelAnchor!.id,
      ];
      return (
        day.legs?.length === places.length + 1 &&
        day.legs.every(
          (l, i) =>
            l.status === "ready" &&
            l.distanceMeters !== null &&
            l.durationSeconds !== null &&
            l.from.id === nodes[i] &&
            l.to.id === nodes[i + 1],
        )
      );
    })
  );
}
export const modeLabel = {
  walking: "步行",
  transit: "公交 / 地铁",
  driving: "驾车 / 打车",
};
export function legLabel(leg: import("./types").RouteLeg) {
  if (
    leg.status !== "ready" ||
    !leg.mode ||
    leg.distanceMeters === null ||
    leg.durationSeconds === null
  )
    return "路线待核实";
  return (
    modeLabel[leg.mode] +
    " · " +
    (leg.distanceMeters >= 1000
      ? (leg.distanceMeters / 1000).toFixed(1) + " km"
      : Math.round(leg.distanceMeters) + " m") +
    " · 约" +
    Math.max(1, Math.round(leg.durationSeconds / 60)) +
    "分钟"
  );
}

function normalizeDayStops(stops: RouteStop[], day: number): RouteStop[] {
  const places = stops
    .filter((s) => s.kind === "place")
    .map((s, index) => ({
      ...s,
      period: (["早上", "下午", "下午", "晚上"] as const)[Math.min(index, 3)],
    }));
  if (!places.length) return [];
  const meal = stops.find((s) => s.kind === "meal");
  const result: RouteStop[] = [...places];
  if (meal) result.splice(1, 0, { ...meal, id: "meal-" + day, period: "中午" });
  return result;
}
