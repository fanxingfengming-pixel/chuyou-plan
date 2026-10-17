import { useRef, type PointerEvent } from "react";
interface Props {
  value: [number, number];
  onChange: (value: [number, number]) => void;
}
const steps = [0, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
export function DualRangeSlider({ value, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null),
    latest = useRef(value);
  latest.current = value;
  const position = (v: number) => (Math.max(0, steps.indexOf(v)) / 9) * 100;
  const positions = value.map(position),
    close = positions[1] - positions[0] < 23;
  const format = (v: number) =>
    v === 0 ? "≤¥200" : v === 2000 ? "¥2000+" : "¥" + v;
  const change = (index: number, next: number) =>
    onChange(
      index === 0
        ? [Math.min(next, latest.current[1]), latest.current[1]]
        : [latest.current[0], Math.max(next, latest.current[0])],
    );
  const pointer = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const node = event.currentTarget;
    const update = (e: globalThis.PointerEvent | PointerEvent) => {
      const rect = track.current!.getBoundingClientRect(),
        step = Math.round(
          Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 9,
        );
      change(index, steps[step]);
    };
    const move = (e: globalThis.PointerEvent) => update(e);
    const end = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", end);
      node.removeEventListener("pointercancel", end);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
    update(event);
  };
  return (
    <div className="dual-range" data-testid="price-range">
      <div className="range-labels">
        {close ? (
          <output className="range-merged">
            {format(value[0])} – {format(value[1])}
          </output>
        ) : (
          positions.map((p, i) => (
            <output
              key={i}
              style={{ left: Math.max(8, Math.min(92, p)) + "%" }}
            >
              {format(value[i])}
            </output>
          ))
        )}
      </div>
      <div className="range-track" ref={track}>
        <div
          className="range-active"
          style={{
            left: positions[0] + "%",
            width: positions[1] - positions[0] + "%",
          }}
        />
        {positions.map((p, i) => (
          <button
            key={i}
            type="button"
            className="range-thumb"
            style={{ left: p + "%" }}
            role="slider"
            aria-label={i === 0 ? "最低每晚价格" : "最高每晚价格"}
            aria-valuemin={i === 0 ? 0 : value[0]}
            aria-valuemax={i === 0 ? value[1] : 2000}
            aria-valuenow={value[i]}
            aria-valuetext={format(value[i])}
            onPointerDown={(e) => pointer(e, i)}
            onKeyDown={(e) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowDown",
                  "ArrowRight",
                  "ArrowUp",
                  "Home",
                  "End",
                ].includes(e.key)
              ) {
                e.preventDefault();
                const index = steps.indexOf(value[i]);
                change(
                  i,
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 2000
                      : steps[
                          Math.max(
                            0,
                            Math.min(
                              9,
                              index +
                                (["ArrowLeft", "ArrowDown"].includes(e.key)
                                  ? -1
                                  : 1),
                            ),
                          )
                        ],
                );
              }
            }}
          />
        ))}
      </div>
      <div className="range-scale">
        <span>≤¥200</span>
        <span>¥600</span>
        <span>¥1,000</span>
        <span>¥1,400</span>
        <span>¥2000+</span>
      </div>
    </div>
  );
}
