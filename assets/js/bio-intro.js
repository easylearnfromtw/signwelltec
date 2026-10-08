/* Scroll-linked, transform-only character motion — no continuous animation loop. */
(()=>{'use strict';
 const chapter=document.getElementById('chapter-one');
 const motion=document.querySelector('.bio-pouch-motion');
 const scene=document.querySelector('.bio-depth-scene');
 if(!chapter||!motion||!scene)return;
 const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
 let visible=true,queued=false;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function render(){
   queued=false;
   if(!visible||mq.matches)return;
   const rect=chapter.getBoundingClientRect();
   const travel=Math.max(1,rect.height-window.innerHeight);
   const p=clamp(-rect.top/travel,0,1);
   const short=window.matchMedia('(max-width: 650px)').matches;
   const y=(short?18:48)-p*(short?54:122);
   const rotation=-8+p*15;
   const scale=.94+p*.14;
   motion.style.transform='translate3d(0,'+y.toFixed(2)+'px,0) rotate('+rotation.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
 }
 function request(){
   if(!visible||mq.matches||queued)return;
   queued=true;requestAnimationFrame(render);
 }
 if('IntersectionObserver' in window){
   const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)request()}, {rootMargin:'15% 0px 15% 0px'});
   io.observe(chapter);
 }
 function setMotionMode(){motion.classList.toggle('is-ready',!mq.matches);if(mq.matches)motion.style.transform='';else request()}
 addEventListener('scroll',request,{passive:true});
 addEventListener('resize',request,{passive:true});
 if(mq.addEventListener)mq.addEventListener('change',setMotionMode);else if(mq.addListener)mq.addListener(setMotionMode);
 setMotionMode();
})();