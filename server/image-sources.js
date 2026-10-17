import { loadConfig } from "./config.js";
import { imageCache, trustedImageUrl, FALLBACK_IMAGE } from "./image-cache.js";
const imageUnavailable = () => ({
  image: FALLBACK_IMAGE,
  imageFallback: true,
  imageSource: "通用风景示意图 · 非实景",
});
export async function placeImage(place, photoHint, signal) {
  return imageCache
    .resolve(
      "amap:" + place.id,
      async () => {
        if (photoHint) return [{ url: photoHint, sourceLabel: "高德地点图片" }];
        const key = loadConfig().amapKey;
        if (!key) return [];
        const url = new URL("https://restapi.amap.com/v5/place/detail");
        url.searchParams.set("id", place.id);
        url.searchParams.set("show_fields", "photos");
        url.searchParams.set("key", key);
        const response = await fetch(url, {
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
            : AbortSignal.timeout(10000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("photo metadata unavailable");
        const data = await response.json();
        if (data.status !== "1") throw new Error("photo metadata unavailable");
        return (data.pois?.find((p) => p.id === place.id)?.photos || []).map(
          (photo) => ({ url: photo.url, sourceLabel: "高德地点图片" }),
        );
      },
      signal,
    )
    .catch(imageUnavailable);
}
export function hotelPhotoCandidates(value) {
  const original = trustedImageUrl(value);
  if (!original) return [];
  const urls = [original];
  const photo = new URL(original);
  // Use the supplier CDN thumbnail for large originals; keep decoder limits.
  if (
    photo.hostname === "img.alicdn.com" &&
    !photo.search &&
    /\.(jpe?g|png|webp)$/i.test(photo.pathname) &&
    !/_\d+x\d+\.[a-z]+$/i.test(photo.pathname)
  ) {
    photo.pathname += "_1200x1200.jpg";
    urls.unshift(photo.href);
  }
  return urls.map((url) => ({ url, sourceLabel: "飞猪供应方图片" }));
}
export async function hotelImage(hotel, signal) {
  return imageCache
    .resolve(
      "flyai:" + hotel.id,
      async () => hotelPhotoCandidates(hotel.image),
      signal,
    )
    .catch(imageUnavailable);
}
