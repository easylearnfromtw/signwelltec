document.addEventListener('DOMContentLoaded',()=>{
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

  const teamCarousel=document.querySelector('[data-team-carousel]');
  if(teamCarousel){
    const prev=document.querySelector('[data-carousel-prev]');
    const next=document.querySelector('[data-carousel-next]');
    const status=document.querySelector('[data-carousel-status]');
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
      if(status && cards.length){
        const center=teamCarousel.scrollLeft+teamCarousel.clientWidth*.35;
        let current=0;
        let best=Infinity;
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
  }


  const personModal=document.querySelector('[data-person-modal]');
  if(personModal){
    const nameEl=personModal.querySelector('[data-person-modal-name]');
    const roleEl=personModal.querySelector('[data-person-modal-role]');
    const linesEl=personModal.querySelector('[data-person-modal-lines]');
    let lastTrigger=null;

    const closePersonModal=()=>{
      personModal.classList.remove('open');
      personModal.setAttribute('aria-hidden','true');
      document.body.classList.remove('person-modal-open');
      lastTrigger?.focus?.();
    };

    const openPersonModal=trigger=>{
      const card=trigger.closest('.person-card');
      if(!card) return;
      const details=(card.dataset.personDetails||'').split('|').filter(Boolean);
      if(!details.length) return;
      lastTrigger=trigger;
      if(nameEl) nameEl.textContent=card.dataset.personName||'';
      if(roleEl) roleEl.textContent=card.dataset.personRole||'';
      if(linesEl){
        linesEl.innerHTML='';
        details.forEach((detail,i)=>{
          const row=document.createElement('div');
          row.className='person-modal-line';
          const label=document.createElement('span');
          label.textContent=String(i+1).padStart(2,'0');
          const value=document.createElement('strong');
          value.textContent=detail;
          row.append(label,value);
          linesEl.append(row);
        });
      }
      personModal.classList.add('open');
      personModal.setAttribute('aria-hidden','false');
      document.body.classList.add('person-modal-open');
      personModal.querySelector('[data-person-close]')?.focus();
    };

    document.querySelectorAll('[data-person-trigger]').forEach(btn=>{
      btn.addEventListener('click',()=>openPersonModal(btn));
    });
    personModal.querySelectorAll('[data-person-close]').forEach(el=>el.addEventListener('click',closePersonModal));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&personModal.classList.contains('open')) closePersonModal()});
  }

  const photoGroups=new Map();
  document.querySelectorAll('img[data-photo]').forEach(img=>{
    const key=img.dataset.photo;
    if(!photoGroups.has(key)) photoGroups.set(key,[]);
    photoGroups.get(key).push(img);
  });
  photoGroups.forEach((images,key)=>{
    fetch(`assets/people/${key}.b64`,{cache:'force-cache'})
      .then(r=>{if(!r.ok) throw new Error('photo asset unavailable'); return r.text()})
      .then(raw=>{
        const src='data:image/webp;base64,'+raw.trim();
        images.forEach(img=>{
          img.src=src;
          img.addEventListener('load',()=>img.closest('.team-card-photo')?.classList.add('loaded'),{once:true});
        });
      })
      .catch(()=>{});
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