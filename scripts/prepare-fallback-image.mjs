import fs from "node:fs/promises";
import { downloadImage } from "../server/image-cache.js";
const source="https://images.unsplash.com/photo-1755147053209-3cf6b1199236?auto=format&fit=crop&w=1200&q=82";
const {data}=await downloadImage(source);
await fs.writeFile("public/images/fallback-landscape.webp",data);
await fs.writeFile("public/images/fallback-landscape.webp.json",JSON.stringify({
  type:"Generic landscape fallback, not a depiction of a named destination",
  author:"Dmytro Yarish / Unsplash",
  source,
  sourcePage:"https://unsplash.com/photos/misty-mountains-reflected-in-a-calm-lake-LyudO7gnERc",
  license:"https://unsplash.com/license",
  verifiedAt:"2026-10-16"
},null,2));
console.log("通用风景图已保存，始终标注非实景。");
