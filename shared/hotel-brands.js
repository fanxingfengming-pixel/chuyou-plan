// Preference groups, not a destination inventory or booking guarantee.
export const HOTEL_BRANDS = Object.freeze([
  "华住会",
  "希尔顿",
  "万豪",
  "洲际",
  "凯悦",
  "雅高",
  "首旅",
]);
const aliases = {
  华住会: ["华住", "hworld", "汉庭", "全季", "桔子", "海友", "漫心", "星程"],
  希尔顿: ["希尔顿", "hilton", "康莱德", "conrad", "逸林", "doubletree"],
  万豪: [
    "万豪",
    "marriott",
    "喜来登",
    "sheraton",
    "威斯汀",
    "westin",
    "万枫",
    "fairfield",
    "万怡",
    "courtyard",
    "万丽",
    "renaissance",
  ],
  洲际: [
    "洲际",
    "ihg",
    "intercontinental",
    "皇冠假日",
    "crowne plaza",
    "智选假日",
    "holiday inn",
    "英迪格",
    "indigo",
    "华邑",
    "hualuxe",
  ],
  凯悦: ["凯悦", "hyatt", "柏悦", "君悦", "安达仕", "andaz"],
  雅高: [
    "雅高",
    "accor",
    "美居",
    "mercure",
    "宜必思",
    "ibis",
    "诺富特",
    "novotel",
    "铂尔曼",
    "pullman",
  ],
  首旅: ["首旅", "如家", "homeinn", "莫泰", "和颐", "璞隐", "扉缦"],
};
export function matchesHotelBrand(hotel, preferences) {
  if (!preferences.length) return true;
  const name = String(hotel.name || "").toLowerCase();
  const brand = String(hotel.brand || "").toLowerCase();
  return preferences.some((group) =>
    (Object.hasOwn(aliases, group) ? aliases[group] : [group]).some(
      (alias) => brand.includes(alias) || name.includes(alias),
    ),
  );
}
