import { ArrowUpRight, Sparkles, ArrowRight } from 'lucide-react'
import { useEffect,useRef,useState,type FormEvent,type ReactNode } from 'react'
import { DEFAULT_PROMPT } from '../data/mock'
import { mockGateway,requestsBudget } from '../services/travelGateway'
import { useTrip } from '../state/TripContext'
import { useTitleAnimation } from '../animations/useAnimations'
export function SectionTitle({children,className=''}:{children:ReactNode;className?:string}){const title=useRef<HTMLHeadingElement>(null);useTitleAnimation(title);return <div className={`title-mask ${className}`}><h2 ref={title} className="section-title" data-title>{children}</h2></div>}
export function ArrowLink({href,children}:{href:string;children:ReactNode}){return <a href={href} className="text-link">{children}<ArrowUpRight size={17}/></a>}
export function CommandBar({id,compact=false}:{id:string;compact?:boolean}){
 const {dispatch}=useTrip(),[value,setValue]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false)
 const controller=useRef<AbortController|null>(null)
 useEffect(()=>()=>controller.current?.abort(),[])
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(!value.trim()||busy)return;controller.current?.abort()
  const request=new AbortController();controller.current=request;dispatch({type:'prompt',value:value.trim()})
  if(requestsBudget(value))dispatch({type:'budgetEnabled',value:true})
  setBusy(true)
  try{await mockGateway.plan(value,request.signal,setStatus);setStatus('已生成东京示例，继续选择你喜欢的住宿区域。');document.getElementById('planner')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
  catch(error){if((error as Error).name!=='AbortError')setStatus('演示暂未完成，请重新尝试。')}
  finally{if(!request.signal.aborted)setBusy(false)}
 }
 return <div className={`command-shell ${compact?'compact':''}`}><form className="command-bar" onSubmit={submit}><Sparkles size={22} aria-hidden="true"/><label className="sr-only" htmlFor={id}>告诉智能助手你的旅行想法</label><input id={id} value={value} onChange={e=>setValue(e.target.value)} placeholder={compact?'下一次，想去哪里？':DEFAULT_PROMPT} maxLength={500} required autoComplete="off"/><button className="command-submit" type="submit" disabled={busy} aria-label={busy?'正在规划':'开始规划'}><span>{busy?'正在规划':'开始规划'}</span><ArrowUpRight size={21}/></button></form><div className="command-status" role="status" aria-live="polite">{status||'灵感由你开始，细节交给智能助手。当前为东京模拟演示。'}</div>{!compact&&<div className="quick-prompts">{['帮我规划旅行','找一家设计酒店','查交通','探索城市路线'].map((text,i)=><button key={text} onClick={()=>setValue([DEFAULT_PROMPT,'东京每晚 1500 元以内，安静的设计酒店','东京机场到酒店怎么走最方便','东京 5 天，喜欢博物馆和城市漫步'][i])}>{text}<ArrowRight size={13}/></button>)}</div>}</div>
}
export function DemoNote({children}:{children?:ReactNode}){return <p className="demo-note">{children||'模拟演示数据 · 价格、评分与可用性非实时，请以官方信息为准。'}</p>}
export const money=(value:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',maximumFractionDigits:0}).format(value)
