import { useState } from "react";
import type { RouteDraft } from "../types";
import { dayColors, mapGeometry } from "../mapGeometry";
import { Message } from "./Common";
export function RouteMap({
  route,
  interactive = true,
}: {
  route: RouteDraft;
  interactive?: boolean;
}) {
  const [day, setDay] = useState<number | undefined>();
  const visibleDay = route.days.some((d) => d.day === day) ? day : undefined;
  const map = mapGeometry(route, visibleDay),
    mock = route.hotelAnchor?.source === "mock";
  if (!map.points.length)
    return <Message>地点还在核实中，路线查询完成后显示地图。</Message>;
  return (
    <figure className="travel-route-map">
      <header>
        <h2>旅行路线草图</h2>
        <span>北 ↑</span>
      </header>
      {interactive && (
        <div className="map-day-tabs">
          <button
            className="secondary-button"
            aria-pressed={visibleDay === undefined}
            onClick={() => setDay(undefined)}
          >
            全部
          </button>
          {route.days.map((d) => (
            <button
              key={d.day}
              className="secondary-button"
              aria-pressed={visibleDay === d.day}
              onClick={() => setDay(d.day)}
            >
              第{d.day}天
            </button>
          ))}
        </div>
      )}
      <svg
        viewBox="0 0 900 600"
        role="img"
        aria-label="酒店H与连续编号景点的旅行路线草图"
      >
        <defs>
          <marker
            id="route-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="3"
            markerHeight="3"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        {map.lines.map((l, i) => (
          <polyline
            key={i}
            points={l.points
              .map((p) => p.x.toFixed(2) + "," + p.y.toFixed(2))
              .join(" ")}
            fill="none"
            stroke={
              l.error ? "#806b5b" : dayColors[(l.day - 1) % dayColors.length]
            }
            strokeWidth="3"
            strokeOpacity=".8"
            strokeDasharray={l.schematic ? "8 7" : undefined}
            markerEnd={l.arrow ? "url(#route-arrow)" : undefined}
            vectorEffect="non-scaling-stroke"
          >
            <title>
              第{l.day}天 ·{" "}
              {l.error
                ? "查询未完成"
                : l.schematic
                  ? "点位连接示意，非道路轨迹"
                  : "高德实际道路轨迹"}
            </title>
          </polyline>
        ))}
        {map.points.map((p) => (
          <g key={p.point.id} transform={"translate(" + p.x + "," + p.y + ")"}>
            <circle
              r={p.label === "H" ? 20 : 17}
              fill={p.label === "H" ? "#3c2b23" : "#fffdf8"}
              stroke="#a74b35"
              strokeWidth="2"
            />
            <text
              textAnchor="middle"
              dy="6"
              fontSize="17"
              fontWeight="700"
              fill={p.label === "H" ? "#fff9ef" : "#a74b35"}
            >
              {p.label}
            </text>
            <title>
              {p.label} · {p.point.name}
            </title>
          </g>
        ))}
      </svg>
      <figcaption>
        <div className="map-legend">
          {route.days
            .filter((d) => d.stops.some((s) => s.kind === "place"))
            .map((d) => (
              <span key={d.day}>
                <i
                  style={{
                    background: dayColors[(d.day - 1) % dayColors.length],
                  }}
                />
                第{d.day}天
              </span>
            ))}
        </div>
        <p>
          {mock
            ? "显式模拟路线 · 不可用于实际出行"
            : "高德地图 · GCJ-02真实坐标" +
              (map.hasOfficialGeometry
                ? " · 高德官方路径服务补充轨迹"
                : "")}{" "}
          · 草图非实时导航
        </p>
        {map.hasSchematic && (
          <p className="schematic-notice">
            虚线为点位连接示意 · 非道路轨迹。距离与耗时以已查到的路段结果为准。
          </p>
        )}
      </figcaption>
      <ol className="map-place-directory">
        {map.points.map((p) => (
          <li key={p.point.id}>
            <strong>{p.label}</strong>
            <span>{p.point.name}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
