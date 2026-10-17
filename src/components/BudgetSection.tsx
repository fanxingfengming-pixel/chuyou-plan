import { ArrowUpRight,Wallet,X } from 'lucide-react'
import { useTrip } from '../state/TripContext'
import { budgetBreakdown } from '../services/travelGateway'
import { DemoNote,SectionTitle,money } from './Shared'
const budgetLabels:Record<string,string>={Hotel:'住宿',Transport:'交通',Food:'餐饮',Tickets:'门票',Other:'其他'}
export default function BudgetSection(){
 const {state,dispatch}=useTrip(),costs=budgetBreakdown(state),spent=Object.values(costs).reduce((a,b)=>a+b,0),remaining=state.budget-spent
 if(!state.budgetEnabled)return <aside className="budget-invitation page-width"><Wallet size={24} strokeWidth={1.3}/><div><h3>想知道，这趟旅行大约花多少？</h3><p>需要的时候，再为你打开预算。</p></div><button className="text-link" onClick={()=>dispatch({type:'budgetEnabled',value:true})}>帮我估算预算<ArrowUpRight size={18}/></button></aside>
 return <section className="budget-section page-width section-space" id="budget"><div className="budget-heading"><SectionTitle>心里有数，<br/><span className="muted-title">才能尽兴出发。</span></SectionTitle><button className="icon-button" aria-label="关闭预算模块" onClick={()=>dispatch({type:'budgetEnabled',value:false})}><X size={21}/></button></div><p className="section-intro">按你确认的住宿与添加的景点，算一笔心里有数的账。</p><label className="budget-input">你的预算（人民币）<input type="number" min="1" max="10000000" step="100" value={state.budget} onChange={e=>dispatch({type:'budget',value:Number(e.target.value)})}/></label><div className="budget-values">{Object.entries(costs).map(([label,value])=><div key={label}><span>{budgetLabels[label]}</span><strong>{label==='Hotel'&&!state.hotelId?'待选住宿':money(value)}</strong></div>)}<div className={`budget-remaining ${remaining<0?'over':''}`}><span>{remaining<0?'超出预算':'剩余预算'}</span><strong>{money(Math.abs(remaining))}</strong></div></div><DemoNote>估算口径：2 人 / 5 天 / 4 晚，住宿按每间计算，门票按 2 人计算。交通 ¥4,400、餐饮 ¥1,500、其他 ¥500 为固定示例估算，不随交通方案联动；住宿未选时总额不完整。无实时汇率、票价或税费。</DemoNote></section>
}
