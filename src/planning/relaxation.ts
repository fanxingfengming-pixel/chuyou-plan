import type {HotelFilters} from "./types";
export function relaxationPlans(f:HotelFilters){
  const plans:{title:string;body:string;patch:Partial<HotelFilters>}[]=[];
  if(f.priceRange[1]!==2000) plans.push({title:"价格更灵活",body:"每晚价格上限改为不限；保留原下限"+(f.priceRange[0]===0 ? "（不限）" : " ¥"+f.priceRange[0])+"和其他条件。",patch:{priceRange:[f.priceRange[0],2000]}});
  if(f.selectedDistricts.length || f.overallRating>0) plans.push({title:"扩大位置与评分范围",body:[f.selectedDistricts.length ? "住宿行政区由"+f.selectedDistricts.join("、")+"改为全城" : "", f.overallRating>0 ? "综合评分由至少"+f.overallRating+"分改为不限" : ""].filter(Boolean).join("；")+"；其他条件保持。",patch:{selectedDistricts:[],overallRating:0}});
  const removed=[f.minRenovationYear ? "装修年份至少"+f.minRenovationYear+"年" : "",f.starLevel ? "星级至少"+f.starLevel : "",f.reviewCount ? "评论数至少"+f.reviewCount : "",f.userScore ? "用户评分至少"+f.userScore : "",f.facilities.length ? "设施："+f.facilities.join("、") : ""].filter(Boolean);
  if(removed.length) plans.push({title:"减少硬性条件",body:removed.join("；")+"改为不限；其他条件保持。",patch:{minRenovationYear:0,starLevel:0,reviewCount:0,userScore:0,facilities:[]}});
  return plans;
}
