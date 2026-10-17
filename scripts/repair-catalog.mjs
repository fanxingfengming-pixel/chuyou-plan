
import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { getPlaceCatalog } from "../server/place-catalog.js";
import { imageCache } from "../server/image-cache.js";
const catalog=getPlaceCatalog();
const repairs=[
 {id:"B02F306L5G",url:"https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/LIANHUASHAN_PARK%2C_SHENZHEN.jpg/1280px-LIANHUASHAN_PARK%2C_SHENZHEN.jpg",author:"Dinkun Chen",page:"https://commons.wikimedia.org/wiki/File:LIANHUASHAN_PARK,_SHENZHEN.jpg"},
 {id:"B0KUNUSAS0",url:"https://upload.wikimedia.org/wikipedia/commons/3/34/Huaqiangbei%26Shennan_Cross2021.jpg",author:"Charlie fong",page:"https://commons.wikimedia.org/wiki/File:Huaqiangbei%26Shennan_Cross2021.jpg"}
];
for(const r of repairs){
 await imageCache.retryMissing("amap:"+r.id);
 const image=await imageCache.resolve("amap:"+r.id,async()=>[{url:r.url,sourceLabel:r.author+" · Wikimedia Commons · CC BY-SA 4.0"}],AbortSignal.timeout(30000));
 const p=catalog.get(r.id);
 catalog.put({...p,...image,imageCredit:{author:r.author,source:r.page,license:"https://creativecommons.org/licenses/by-sa/4.0/",modification:"缩小、转换为WebP，页面按容器裁切展示。"}});
 console.log(p.name+" "+(image.imageFallback?"仍无实图":"已补实图"));
}
const areas=catalog.areas("广州");
const proper=catalog.get("B00140H88E");
if(!proper || proper.name!=="陈家祠堂")throw new Error("CORRECT_PLACE_NOT_VERIFIED");
const replacement=catalog.put({...proper,type:"景点",description:"在陈氏书院欣赏岭南建筑与传统工艺。",seedQuery:"陈氏书院"});
catalog.setAreas("广州",areas.map(p=>p.id==="BV10015239"?replacement:p));
catalog.remember("广州","陈家祠",[replacement]);
// Remove only the incorrectly classified record inserted by this task.
const db=new DatabaseSync("data/place-catalog.sqlite");
db.prepare("DELETE FROM places WHERE id=? AND name=? AND city=?").run("BV10015239","陈家祠(地铁站)","广州");
db.close();
const cities=["北京","上海","广州","深圳","杭州"],index=JSON.parse(await fs.readFile("data/image-cache/index.json","utf8")).entries;
const old=JSON.parse(await fs.readFile("public/mock/v2/catalog.json","utf8"));
const report=[];
await fs.mkdir("public/images/places",{recursive:true});
for(const city of cities){
 const places=catalog.areas(city);
 old.cities[city].places=[];
 for(const p of places){
  let image=p.image;
  if(/^\/api\/travel\/media\/[a-f0-9]{64}\.webp$/.test(image||"")){
   const name=image.split("/").pop();await fs.copyFile("data/image-cache/"+name,"public/images/places/"+name);image="/images/places/"+name;
  }
  old.cities[city].places.push({...p,image,source:"mock"});
  report.push({...p,realImage:!!p.image&&!p.imageFallback,originalImageUrl:index["amap:"+p.id]?.sourceUrl,sourceNote:p.imageCredit?"开放许可，署名与许可链接随图片提供。":"高德地点图片，来源不等于独立官网宣传授权。"});
 }
}
await fs.writeFile("public/mock/v2/catalog.json",JSON.stringify(old,null,2));
await fs.writeFile("artifacts/warm-v3/catalog-report.json",JSON.stringify(report,null,2));
await fs.writeFile("docs/PLACE_CATALOG.md","# 五城地点素材清单\n\n采集日期：2026-10-17。坐标和行政区由现有高德服务核实。图片下载与解码沿用原防护。\n\n高德照片记录供应方来源，不声明已取得逐家官网宣传授权。两张Commons照片按CC BY-SA 4.0署名并提供许可，缩小转WebP后的图片继续采用同一许可。\n\n| 城市 | 地点 | 类别 | 行政区 | 实景 | 来源 |\n| --- | --- | --- | --- | --- | --- |\n"+report.map(p=>"| "+[p.city,p.name,p.type,p.district,p.realImage?"已缓存":"缺口",p.imageSource].join(" | ")+" |").join("\n")+"\n\n完整图片地址、稳定POI、核对日期和版权记录见项目内 artifacts/warm-v3/catalog-report.json。\n\n"+repairs.map(r=>"- ["+r.author+" 的原始照片]("+r.page+")；[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)").join("\n")+"\n");
console.log(JSON.stringify({count:report.length,realImages:report.filter(p=>p.realImage).length,types:Object.fromEntries(cities.map(c=>[c,report.filter(p=>p.city.replace(/市$/,"")===c).map(p=>p.type)]))}));
catalog.close();
