import fs from "node:fs";
const base = "http://127.0.0.1:5173/api/travel";
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 2 * 86400000));
const trip = {
  destinationCity: "北京",
  originCity: "长沙",
  dateMode: "exact",
  departureDate: date,
  returnDate: new Date(Date.parse(date) + 3 * 86400000)
    .toISOString()
    .slice(0, 10),
  tripDays: 4,
  adults: 2,
  children: 0,
  selectedPlaces: [],
  primaryPlace: null,
  recommendedDistricts: [],
  brandPreference: [],
  selectedTransportMode: "rail",
  priceRange: [0, 2000],
  minRenovationYear: 0,
  overallRating: 0,
  subwayDistance: 999999,
  selectedDistricts: [],
  starLevel: 0,
  reviewCount: 0,
  userScore: 0,
  facilities: [],
};
const checks = [];
for (const service of ["flight/search", "flyai/search-hotels"]) {
  const start = Date.now();
  const response = await fetch(base + "/" + service, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trip),
    signal: AbortSignal.timeout(180000),
  });
  const data = await response.json();
  const summary = {
    service,
    httpStatus: response.status,
    elapsedMs: Date.now() - start,
    ...(Array.isArray(data)
      ? {
          count: data.length,
          sources: [...new Set(data.map((h) => h.source))],
          withBooking: data.filter((h) => !!h.bookingUrl).length,
        }
      : {
          mode: data.mode,
          source: data.source,
          available: data.available,
          errorCode: data.error?.code,
        }),
  };
  checks.push(summary);
  console.log(JSON.stringify(summary));
}
const health = await (await fetch(base + "/health")).json();
const passed =
  checks.every((c) => c.httpStatus === 200) &&
  health.flyai.runtimeVersion === "v24.20.0" &&
  health.flyai.queryCount >= 2 &&
  health.flyai.failedProcessCount === 0 &&
  !health.flyai.cliExitWarning;
fs.writeFileSync(
  "artifacts/integration/flyai-runtime-http.json",
  JSON.stringify(
    { checkedAt: new Date().toISOString(), checks, health, passed },
    null,
    2,
  ),
);
console.log(JSON.stringify({ health, passed }));
if (!passed) process.exitCode = 1;
