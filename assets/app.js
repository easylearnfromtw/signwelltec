document.addEventListener('DOMContentLoaded',()=>{
  const pageTransition=document.createElement('div');
  pageTransition.className='page-transition-layer';
  pageTransition.setAttribute('aria-hidden','true');
  document.body.appendChild(pageTransition);
  // Hard invariant: the site may scroll vertically, never horizontally.
  const lockHorizontalViewport=()=>{
    document.documentElement.style.overflowX='clip';
    document.body.style.overflowX='clip';
    if(window.scrollX!==0){
      const y=window.scrollY;
      window.scrollTo(0,y);
    }
  };
  lockHorizontalViewport();
  window.addEventListener('resize',lockHorizontalViewport,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(lockHorizontalViewport,120),{passive:true});
  window.addEventListener('scroll',lockHorizontalViewport,{passive:true});
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  const page=document.body.dataset.page;
  document.querySelectorAll('.desktop-nav a').forEach(a=>{
    const href=a.getAttribute('href')||'';
    if(page && href.startsWith(page==='home'?'index':page)) a.classList.add('active');
  });

  const toggle=document.querySelector('.menu-toggle');
  const menu=document.querySelector('.mobile-menu');
  if(toggle&&menu){
    const setMenu=open=>{
      menu.classList.toggle('open',open);
      document.body.classList.toggle('menu-open',open);
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'關閉選單':'開啟選單');
      const menuLabel=toggle.querySelector('.menu-label');
      if(menuLabel) menuLabel.textContent=open?'關閉':'選單';
      menu.setAttribute('aria-hidden',String(!open));
    };
    toggle.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
    menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
    document.addEventListener('keydown',e=>{if(e.key==='Escape') setMenu(false)});
  }

  const reveals=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}});
    },{threshold:.12});
    reveals.forEach(el=>io.observe(el));
  }else reveals.forEach(el=>el.classList.add('visible'));

  document.querySelectorAll('[data-team-carousel]').forEach(teamCarousel=>{
    const scope=teamCarousel.closest('.section,.editorial-body,main')||document;
    const prev=scope.querySelector('[data-carousel-prev]');
    const next=scope.querySelector('[data-carousel-next]');
    const status=scope.querySelector('[data-carousel-status]');
    const cards=[...teamCarousel.querySelectorAll('.team-card')];

    const step=()=>{
      const first=cards[0];
      if(!first) return Math.max(260,teamCarousel.clientWidth*.8);
      const gap=parseFloat(getComputedStyle(teamCarousel).columnGap||getComputedStyle(teamCarousel).gap||0)||0;
      return first.getBoundingClientRect().width+gap;
    };
    const updateControls=()=>{
      const max=Math.max(0,teamCarousel.scrollWidth-teamCarousel.clientWidth-2);
      if(prev) prev.disabled=teamCarousel.scrollLeft<=2;
      if(next) next.disabled=teamCarousel.scrollLeft>=max;
      if(status&&cards.length){
        const center=teamCarousel.scrollLeft+teamCarousel.clientWidth*.35;
        let current=0,best=Infinity;
        cards.forEach((card,i)=>{
          const d=Math.abs(card.offsetLeft-center);
          if(d<best){best=d;current=i}
        });
        status.textContent=`${String(current+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
      }
    };
    prev?.addEventListener('click',()=>teamCarousel.scrollBy({left:-step(),behavior:'smooth'}));
    next?.addEventListener('click',()=>teamCarousel.scrollBy({left:step(),behavior:'smooth'}));
    teamCarousel.addEventListener('scroll',updateControls,{passive:true});
    window.addEventListener('resize',updateControls,{passive:true});
    teamCarousel.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'){e.preventDefault();teamCarousel.scrollBy({left:-step(),behavior:'smooth'})}
      if(e.key==='ArrowRight'){e.preventDefault();teamCarousel.scrollBy({left:step(),behavior:'smooth'})}
    });
    updateControls();
  });

  // Internal page transition
  window.addEventListener('pageshow',()=>{document.body.classList.remove('page-leaving');document.documentElement.classList.remove('page-transition-active')});
  document.querySelectorAll('a[href]').forEach(a=>{
    a.addEventListener('click',e=>{
      if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
      if(a.target==='_blank'||a.hasAttribute('download')) return;
      const href=a.getAttribute('href')||'';
      if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('javascript:')) return;
      const url=new URL(a.href,location.href);
      if(url.origin!==location.origin) return;
      if(url.pathname===location.pathname&&url.hash) return;
      e.preventDefault();
      document.body.classList.add('page-leaving');
      document.documentElement.classList.add('page-transition-active');
      setTimeout(()=>{location.href=url.href},400);
    });
  });

  // Pointer/tap feedback for interactive controls
  const pressables=document.querySelectorAll('a,button,.service-card,.portfolio-row');
  pressables.forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      el.classList.add('ui-pressed');
      const rect=el.getBoundingClientRect();
      const ripple=document.createElement('span');
      ripple.className='ui-ripple';
      ripple.style.left=`${e.clientX-rect.left}px`;
      ripple.style.top=`${e.clientY-rect.top}px`;
      el.appendChild(ripple);
      setTimeout(()=>ripple.remove(),500);
    });
    const release=()=>setTimeout(()=>el.classList.remove('ui-pressed'),80);
    el.addEventListener('pointerup',release,{passive:true});
    el.addEventListener('pointercancel',release,{passive:true});
    el.addEventListener('pointerleave',release,{passive:true});
  });

  const form=document.querySelector('[data-rfq-form]');
  const status=document.querySelector('[data-form-status]');
  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const data=new FormData(form);
      const lines=[
        'SIGNWELL 詢價需求',
        '----------------',
        ...Array.from(data.entries()).map(([k,v])=>`${k}: ${v||'-'}`)
      ];
      const text=lines.join('\n');
      try{
        await navigator.clipboard.writeText(text);
        if(status) status.textContent='詢價內容已複製，可貼到您使用的聯絡工具中。';
      }catch{
        if(status) status.textContent='已整理詢價內容；您的瀏覽器未允許自動複製，請手動複製欄位資訊。';
      }
    });
  }
});