import { useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
export function useSectionAnimations(root:RefObject<HTMLElement|null>) {
 useLayoutEffect(()=>{
  const media=gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)',()=>{
   const ctx=gsap.context(()=>{
    gsap.utils.toArray<HTMLElement>('.final-content [data-title]').forEach(el=>gsap.from(el,{yPercent:85,scaleY:1.12,letterSpacing:'0.025em',duration:1.25,ease:'power4.out',scrollTrigger:{trigger:el,start:'top 94%',once:true}}))
    gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach(group=>gsap.from(group.querySelectorAll('[data-card]'),{y:70,clipPath:'inset(15% 0 0 0)',opacity:0,duration:1.15,stagger:0.16,ease:'power3.out',scrollTrigger:{trigger:group,start:'top 88%',once:true}}))
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(el=>{
     gsap.from(el,{clipPath:'inset(100% 0 0 0)',duration:1.4,ease:'power4.inOut',scrollTrigger:{trigger:el,start:'top 92%',once:true}})
     const img=el.querySelector('img');if(img)gsap.fromTo(img,{scale:1.12},{scale:1,duration:1.6,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 92%',once:true}})
    })
    if(window.innerWidth>=768)gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach(el=>gsap.fromTo(el,{yPercent:-3},{yPercent:3,ease:'none',scrollTrigger:{trigger:el.parentElement,start:'top bottom',end:'bottom top',scrub:1}}))
    gsap.utils.toArray<SVGPathElement>('[data-route]').forEach(path=>{const length=path.getTotalLength();gsap.fromTo(path,{strokeDasharray:length,strokeDashoffset:length},{strokeDashoffset:0,duration:2.2,ease:'power2.inOut',scrollTrigger:{trigger:path.closest('svg'),start:'top 85%',once:true}})})
   },root)
   return ()=>ctx.revert()
  })
  let mounted=true
  let resizeTimer:ReturnType<typeof setTimeout>
  const refresh=()=>{if(mounted)ScrollTrigger.refresh()}
  const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refresh,120)})
  if(root.current)observer.observe(root.current)
  document.fonts.ready.then(refresh);window.addEventListener('load',refresh,{once:true})
  return ()=>{mounted=false;clearTimeout(resizeTimer);observer.disconnect();media.revert();window.removeEventListener('load',refresh)}
 },[root])
}
export function useTitleAnimation(root:RefObject<HTMLHeadingElement|null>){
 useLayoutEffect(()=>{
  const media=gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)',()=>{
   const ctx=gsap.context(()=>{if(root.current)gsap.from(root.current,{yPercent:85,scaleY:1.12,letterSpacing:'0.025em',duration:1.25,ease:'power4.out',scrollTrigger:{trigger:root.current,start:'top 94%',once:true}})},root)
   return()=>ctx.revert()
  })
  return()=>media.revert()
 },[root])
}
export function useOpening(root:RefObject<HTMLElement|null>,done:()=>void,skip:boolean){
 const complete=useRef(done);complete.current=done
 useLayoutEffect(()=>{
  if(skip||window.matchMedia('(prefers-reduced-motion: reduce)').matches){complete.current();return}
  let fallback:ReturnType<typeof setTimeout>
  const ctx=gsap.context(()=>{
   const timeline=gsap.timeline({onComplete:()=>{clearTimeout(fallback);complete.current()}})
    .from('.opening-word',{yPercent:120,duration:0.8,ease:'power4.out'})
    .to('.opening-word',{yPercent:-120,duration:0.65,ease:'power4.in',delay:0.3})
    .to('.opening',{clipPath:'inset(0 0 100% 0)',duration:1.1,ease:'expo.inOut'},'-=0.1')
    .from('.hero-visual',{scale:1.16,clipPath:'inset(12% 10% 12% 10%)',duration:1.6,ease:'expo.out'},'-=0.65')
    .from('.hero-title-line',{yPercent:120,scaleY:1.35,letterSpacing:'0.04em',duration:1.4,stagger:0.15,ease:'power4.out'},'-=1.15')
    .from('.hero-enter',{y:35,opacity:0,duration:0.8,stagger:0.12,ease:'power3.out'},'-=0.75')
   // Background tabs and constrained preview browsers can throttle RAF; never leave the content masked.
   fallback=setTimeout(()=>timeline.progress(1),6200)
  },root);return()=>{clearTimeout(fallback);ctx.revert()}
 },[root,skip])
}
