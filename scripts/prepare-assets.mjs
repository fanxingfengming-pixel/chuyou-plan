import {mkdir,writeFile} from 'node:fs/promises'
import sharp from 'sharp'
import {fileURLToPath} from 'node:url'
const root=new URL('../',import.meta.url)
const out=new URL('public/images/',root)
await mkdir(out,{recursive:true})
const generated=fileURLToPath(new URL('assets/source/tokyo-hero-original.png',root))
await sharp(generated).resize(1920,1080,{fit:'cover'}).webp({quality:88}).toFile(fileURLToPath(new URL('tokyo-hero.webp',out)))
const photos={
 'aoyama':'photo-1536098561742-ca998e48cbcc',
 'nihonbashi':'photo-1540959733332-eab4deabeeaf',
 'shinjuku':'photo-1542051841857-5f90071e7989',
 'hotel-aoyama':'photo-1611892440504-42a792e24d32',
 'hotel-kura':'photo-1613977257363-707ba9348227',
 'hotel-west':'photo-1590490360182-c33d57733427',
 'hotel-garden':'photo-1618773928121-c32242e63f39',
 'nezu':'photo-1493976040374-85c8e12f0c0e',
 'teamlab':'photo-1535223289827-42f1e9919769',
 'museum':'photo-1564399579883-451a5d44ec08',
}
const ledger=[{file:'tokyo-hero.webp',origin:'OpenAI image_gen, built-in tool',type:'AI-generated illustrative mood image',prompt:'Cinematic Tokyo cityscape at blue hour, distant Mount Fuji silhouette, detailed city and warm lights in lower half, desaturated slate sky, clean dark negative space for typography, editorial photography, no text or logo.',fullPrompt:'assets/source/tokyo-hero-original.png.json'}]
await Promise.all(Object.entries(photos).map(async([name,id])=>{
 const url=`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`
 const response=await fetch(url);if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`)
 const buffer=Buffer.from(await response.arrayBuffer())
 await sharp(buffer).resize(1200,1200,{fit:'inside',withoutEnlargement:true}).webp({quality:84}).toFile(fileURLToPath(new URL(`${name}.webp`,out)))
 ledger.push({file:`${name}.webp`,origin:url,type:'Unsplash theme photography, illustrative only; not a depiction of named mock hotel or attraction'})
 await writeFile(new URL(`${name}.webp.json`,out),JSON.stringify({origin:url,purpose:'Theme mood image only'},null,2))
 console.log(`Saved ${name}.webp`)
}))
await writeFile(new URL('ASSETS.json',root),JSON.stringify(ledger,null,2))
await writeFile(new URL('tokyo-hero.webp.json',out),JSON.stringify(ledger[0],null,2))
console.log('All assets are saved locally in D:/aaa飞猪/public/images')
