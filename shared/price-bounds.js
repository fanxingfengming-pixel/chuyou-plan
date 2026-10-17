// Slider sentinels stay compatible with existing tripDraft values.
export function priceBounds([min, max]) {
  return { min, max: max === 0 ? 200 : max === 2000 ? Infinity : max };
}
