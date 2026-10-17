import type { Area, Attraction, Hotel, HotelFilters, TransportOption } from '../types'

export const DEFAULT_PROMPT = '11 月和另一半去东京 5 天，喜欢设计、咖啡和安静的街区'
export const areas: Area[] = [
  { id:'aoyama', name:'青山 · 表参道', displayName:'青山', image:'/images/aoyama.webp', mood:'设计、绿意与街角咖啡', audience:'设计爱好者 / 慢旅行 / 情侣', transport:'银座线、千代田线，步行友好', price:'¥1,200–2,200 / 晚', distance:'根津美术馆约 1.2 公里', reason:'如果你喜欢把时间留给建筑、展览与一杯咖啡，这里值得慢下来。' },
  { id:'nihonbashi', name:'日本桥 · 东京站', displayName:'日本桥', image:'/images/nihonbashi.webp', mood:'老东京的秩序，新东京的日常', audience:'首次到访 / 美食探索 / 城际出行', transport:'东京站交通枢纽，机场衔接方便', price:'¥800–1,600 / 晚', distance:'皇居周边约 2.5 公里', reason:'兼顾城市探索与交通便利，适合用一个稳定的落脚点串联整座城市。' },
  { id:'shinjuku', name:'新宿 · 代代木', displayName:'新宿', image:'/images/shinjuku.webp', mood:'城市的热烈，公园的留白', audience:'夜景爱好者 / 购物 / 首次到访', transport:'铁路与多条地铁交汇，注意出口', price:'¥700–1,800 / 晚', distance:'新宿御苑约 1.0 公里', reason:'想要热闹的夜晚，也想要安静的清晨，可以在车站与公园之间找到平衡。' },
]
export const hotels: Hotel[] = [
  { id:'aoyama-house', name:'青山居', areaId:'aoyama', tagline:'住进东京的安静一面。', image:'/images/hotel-aoyama.webp', stars:5, score:9.4, userRating:4.8, reviews:826, subway:280, renovated:2024, landmarkDistance:'根津美术馆 1.2 公里', price:1480, features:['设计酒店','庭院早餐','安静街区'], description:'木质、自然光与庭院。把城市的喧闹留在门外，在青山开始一段慢旅行。酒店名称与全部商业数据为虚构示例，图片为氛围素材。', source:'mock' },
  { id:'kura-nihonbashi', name:'日本桥仓舍', areaId:'nihonbashi', tagline:'旧城气韵，全新视角。', image:'/images/hotel-kura.webp', stars:4, score:9.2, userRating:4.7, reviews:1432, subway:180, renovated:2023, landmarkDistance:'皇居周边 2.5 公里', price:980, features:['历史建筑风格','近地铁','独立咖啡厅'], description:'以仓库建筑为灵感的城市居所，适合在咖啡、街巷与美术馆之间自由切换。酒店名称与全部商业数据为虚构示例，图片为氛围素材。', source:'mock' },
  { id:'westside', name:'新宿西舍', areaId:'shinjuku', tagline:'在城市的晨光里醒来。', image:'/images/hotel-west.webp', stars:4, score:8.9, userRating:4.5, reviews:2180, subway:420, renovated:2022, landmarkDistance:'新宿御苑 1.0 公里', price:780, features:['城市天际线','交通便利','自助早餐'], description:'为热爱城市节奏的人准备的高层居所。酒店名称与全部商业数据为虚构示例，图片为氛围素材。', source:'mock' },
  { id:'garden-aoyama', name:'花园小筑', areaId:'aoyama', tagline:'给旅途，留一点呼吸。', image:'/images/hotel-garden.webp', stars:4, score:9.1, userRating:4.6, reviews:368, subway:650, renovated:2021, landmarkDistance:'根津美术馆 0.6 公里', price:1160, features:['小型精品','花园露台','轻松步行'], description:'面向花园的小型酒店，留一点时间给无目的的散步。酒店名称与全部商业数据为虚构示例，图片为氛围素材。', source:'mock' },
]
export const attractions: Attraction[] = [
  { id:'nezu', name:'根津美术馆', displayName:'根津美术馆', image:'/images/nezu.webp', duration:'2–3 小时', hours:'10:00–17:00（示例）', ticket:80, distance:'示例距青山住宿 1.2 公里', reason:'建筑、庭园与收藏的安静对话，留给喜欢设计与自然的你。', officialUrl:'https://www.nezu-muse.or.jp/' },
  { id:'teamlab', name:'无界美术馆', displayName:'无界光影', image:'/images/teamlab.webp', duration:'2–3 小时', hours:'09:00–21:00（示例）', ticket:230, distance:'示例距青山住宿 4.1 公里', reason:'在没有边界的光影里漫游，为这趟旅行留一个不一样的下午。', officialUrl:'https://www.teamlab.art/e/tokyo/' },
  { id:'tnm', name:'东京国立博物馆', displayName:'换个角度看世界', image:'/images/museum.webp', duration:'3–4 小时', hours:'09:30–17:00（示例）', ticket:50, distance:'示例距青山住宿 9.3 公里', reason:'从一件器物开始认识一座城市，适合愿意停下来细看的旅行。', officialUrl:'https://www.tnm.jp/' },
]
export const transportOptions: TransportOption[] = [
  {id:'train-fast',mode:'train',priority:'fastest',title:'机场快线 + 地铁',origin:'成田机场',destination:'青山示例酒店',departure:'10:20',arrival:'11:35',duration:'1 小时 15 分钟',transfers:'1 次换乘',hotelAccess:'末段步行 280 米',convenience:'适合轻装，衔接紧凑',price:190},
  {id:'train-value',mode:'train',priority:'value',title:'普通电车 + 地铁',origin:'成田机场',destination:'青山示例酒店',departure:'10:10',arrival:'12:05',duration:'1 小时 55 分钟',transfers:'2 次换乘',hotelAccess:'末段步行 280 米',convenience:'价格较低，预留换乘时间',price:85},
  {id:'train-comfort',mode:'train',priority:'comfort',title:'指定席特急 + 出租车',origin:'成田机场',destination:'青山示例酒店',departure:'10:30',arrival:'12:00',duration:'1 小时 30 分钟',transfers:'1 次换乘',hotelAccess:'到达酒店门口',convenience:'全程有座，适合携带行李',price:360},
  {id:'flight-fast',mode:'flight',priority:'fastest',title:'上海 → 东京 · 直飞早班',origin:'上海浦东机场',destination:'东京羽田机场',departure:'08:30',arrival:'12:15',duration:'2 小时 45 分钟',transfers:'直飞',hotelAccess:'落地后约 55 分钟到青山',convenience:'较早抵达，保留半天探索',price:1850},
  {id:'flight-value',mode:'flight',priority:'value',title:'上海 → 东京 · 经停示例',origin:'上海浦东机场',destination:'东京成田机场',departure:'09:10',arrival:'16:30',duration:'6 小时 20 分钟',transfers:'1 次换乘',hotelAccess:'落地后约 90 分钟到青山',convenience:'节省票价，需要更多时间',price:1150},
  {id:'flight-comfort',mode:'flight',priority:'comfort',title:'上海 → 东京 · 直飞午班',origin:'上海浦东机场',destination:'东京羽田机场',departure:'12:30',arrival:'16:20',duration:'2 小时 50 分钟',transfers:'直飞',hotelAccess:'落地后约 55 分钟到青山',convenience:'无需早起，托运行李示例',price:2200},
  {id:'transit-fast',mode:'transit',priority:'fastest',title:'银座线 · 城市探索',origin:'表参道',destination:'上野',departure:'09:00',arrival:'09:33',duration:'33 分钟',transfers:'无需换乘',hotelAccess:'酒店至车站步行 280 米',convenience:'直达主要文化街区',price:14},
  {id:'transit-value',mode:'transit',priority:'value',title:'地铁日票 · 多次出行',origin:'表参道',destination:'上野 / 浅草',departure:'09:00',arrival:'09:45',duration:'45 分钟',transfers:'按目的地换乘',hotelAccess:'酒店至车站步行 280 米',convenience:'适合当天多次乘坐',price:40},
  {id:'transit-comfort',mode:'transit',priority:'comfort',title:'步行 + 出租车',origin:'青山示例酒店',destination:'上野公园',departure:'09:00',arrival:'09:40',duration:'40 分钟',transfers:'无需换乘',hotelAccess:'酒店门口上车',convenience:'少步行，路况影响时间',price:160},
]
export const defaultFilters: HotelFilters = { maxPrice:2400,minScore:0,stars:0,maxSubway:2000,minRenovated:0,minUserRating:0,minReviews:0 }
export const planningStages = ['正在寻找适合的街区','正在比较酒店','正在核对交通','正在串联旅行路线']
