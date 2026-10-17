
import fs from "node:fs/promises";
import { searchPlaces, closeMcpClients } from "../server/mcp.js";
import { getPlaceCatalog } from "../server/place-catalog.js";
const seeds={
 北京:[["故宫博物院","景点","走入宫殿与庭院，认识城市的历史。"],["景山公园","景点","在山顶眺望中轴线与老城屋顶。"],["天坛公园","景点","沿古建与林荫步道慢慢游览。"],["王府井","商圈","步行街与商店集中的城市街区。"],["西单","商圈","商场与公共交通汇集的购物街区。"],["三里屯","商圈","餐饮、商店与当代城市生活相遇。"]],
 上海:[["外滩","景点","沿黄浦江岸欣赏城市建筑。"],["豫园","景点","在园林与街巷之间感受江南。"],["上海博物馆人民广场馆","景点","从馆藏出发认识艺术与历史。"],["南京东路","商圈","沿步行街探索商店与城市日常。"],["静安寺商圈","商圈","城市商业街区中的购物与休憩。"],["徐家汇","商圈","购物、餐饮与交通汇集的街区。"]],
 广州:[["广州塔","景点","珠江沿岸的城市地标。"],["越秀公园","景点","在老城公园里放慢步调。"],["陈氏书院","景点","欣赏岭南建筑与传统工艺。"],["北京路步行街","商圈","老城街巷中的购物与餐饮。"],["天河城","商圈","天河路商业街区的购物落点。"],["花城汇","商圈","珠江新城中的休闲与餐饮街区。"]],
 深圳:[["世界之窗","景点","探索主题景观与游园体验。"],["莲花山公园","景点","沿绿地步道欣赏城市景观。"],["深圳湾公园","景点","在海湾步道散步与休憩。"],["东门老街","商圈","传统商业街中的购物与小吃。"],["华强北","商圈","电子商业街区与城市日常。"],["海岸城购物中心","商圈","南山的购物、餐饮与休闲落点。"]],
 杭州:[["西湖","景点","沿湖步道与山水之间的城市漫步。"],["灵隐寺","景点","山林与古建之间的安静停留。"],["中国丝绸博物馆","景点","从丝绸了解工艺与文化。"],["湖滨银泰in77","商圈","湖边街区中的购物与餐饮。"],["武林广场","商圈","城市中心的商业与公共空间。"],["万象城杭州","商圈","钱江新城的购物与休闲落点。"]]
};
const report=[]; await fs.mkdir("artifacts/warm-v3",{recursive:true});
const catalog=getPlaceCatalog();
for(const [city,rows] of Object.entries(seeds)){
 const places=[];
 for(const [query,type,description] of rows){
  try {
   const found=await searchPlaces(query,city,AbortSignal.timeout(90000),type,1);
   const p=found[0]; if(!p)throw Object.assign(new Error(),{code:"PLACE_UNRESOLVED"});
   const prepared=catalog.put({...p,type,description,seedQuery:query});
   places.push(prepared);
   report.push({city,query,id:p.id,name:p.name,type,image:p.image,imageSource:p.imageSource,realImage:!!p.image&&!p.imageFallback,district:p.district,checkedAt:prepared.checkedAt});
   console.log(city+" "+query+" "+(p.imageFallback?"无实图":"实图已缓存"));
  }catch(e){report.push({city,query,type,error:e.code||"QUERY_FAILED",realImage:false});console.log(city+" "+query+" "+(e.code||"QUERY_FAILED"));}
  await fs.writeFile("artifacts/warm-v3/catalog-report.json",JSON.stringify(report,null,2));
 }
 if(places.length)catalog.setAreas(city,places);
}
const old=JSON.parse(await fs.readFile("public/mock/v2/catalog.json","utf8"));
await fs.mkdir("public/images/places",{recursive:true});
for(const city of Object.keys(seeds)){
 const places=catalog.areas(city);
 if(!old.cities[city])old.cities[city]={country:"CN",priceRange:[400,800],brands:[],hotels:[]};
 old.cities[city].places=await Promise.all(places.map(async p=>{
  let image=p.image;
  if(/^\/api\/travel\/media\/[a-f0-9]{64}\.webp$/.test(image||"")){
   const name=image.split("/").pop();await fs.copyFile("data/image-cache/"+name,"public/images/places/"+name);image="/images/places/"+name;
  }
  return {...p,image,source:"mock",loadedFrom:"catalog",imageSource:p.imageSource};
 }));
}
await fs.writeFile("public/mock/v2/catalog.json",JSON.stringify(old,null,2));
console.log(JSON.stringify({count:report.length,realImages:report.filter(p=>p.realImage).length,failed:report.filter(p=>p.error).length}));
await closeMcpClients();catalog.close();
