document.addEventListener('DOMContentLoaded',()=>{
  // Show the original welcome only once per tab session.
  // Normal links use native navigation with no transition.
  let showWelcome=false;
  try{
    showWelcome=sessionStorage.getItem('signwell-welcome-seen')!=='1';
    if(showWelcome) sessionStorage.setItem('signwell-welcome-seen','1');
  }catch{
    // No storage access: navigation must remain unaffected.
  }
  if(showWelcome && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const welcome=document.createElement('div');
    welcome.className='page-welcome-layer';
    welcome.setAttribute('aria-hidden','true');
    const label=document.createElement('span');
    label.className='page-welcome-brand';
    label.textContent='SIGNWELL欣緯科技';
    welcome.appendChild(label);
    document.body.appendChild(welcome);
    setTimeout(()=>{
      welcome.classList.add('welcome-exit');
      setTimeout(()=>welcome.remove(),280);
    },500);
  }
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

  // Page links now navigate directly, without a transition or delay.

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

  // Business contact disclosure: no phone number is shown until requested.
  document.querySelectorAll('[data-phone-reveal]').forEach(button=>{
    const panel=document.getElementById(button.getAttribute('aria-controls'));
    if(!panel) return;
    button.addEventListener('click',()=>{
      const reveal=panel.hidden;
      panel.hidden=!reveal;
      button.setAttribute('aria-expanded',String(reveal));
      button.textContent=reveal?'隱藏聯絡電話':'顯示聯絡電話';
    });
  });

  // Sourcing guide: choose a scenario without leaving the page.
  const sourcingScenarios={
    part:{
      title:'已有完整料號',
      description:'先確認型號、版本與製造商資料是否一致，避免誤用相似名稱。',
      points:['完整料號（包括前後綴）','製造商名稱及規格書','數量、包裝方式、期望時程','是否接受替代料']
    },
    spec:{
      title:'只有規格需求',
      description:'先區分不可改變的規格和可以討論的條件，避免過早假設某個型號適用。',
      points:['使用情境與關鍵電氣條件','尺寸、封裝或安裝介面','必須符合的標準及限制','需求數量與期望時程']
    },
    project:{
      title:'多項專案採購',
      description:'建議用清楚的項目清單整理不同料件，再逐一核對規格與優先順序。',
      points:['BOM 或多項料件清單及版本','各項料號、製造商與數量','不可替代或優先確認的項目','整體進度與分批需求']
    }
  };
  const sourcingOutput=document.querySelector('[data-sourcing-output]');
  document.querySelectorAll('[data-sourcing-mode]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!sourcingOutput) return;
      const info=sourcingScenarios[btn.dataset.sourcingMode];
      if(!info) return;
      document.querySelectorAll('[data-sourcing-mode]').forEach(item=>{
        const selected=item===btn;
        item.classList.toggle('is-selected',selected);
        item.setAttribute('aria-pressed',String(selected));
      });
      sourcingOutput.querySelector('[data-sourcing-title]').textContent=info.title;
      sourcingOutput.querySelector('[data-sourcing-description]').textContent=info.description;
      const list=sourcingOutput.querySelector('[data-sourcing-list]');
      list.replaceChildren();
      info.points.forEach(point=>{
        const item=document.createElement('li');
        item.textContent=point;
        list.appendChild(item);
      });
    });
  });

  // RFQ wizard: client-side formatting only. No backend and no send action.
  const form=document.querySelector('[data-rfq-form]');
  if(form){
    const steps=[...form.querySelectorAll('[data-rfq-step]')];
    const stepNames=['需求類型','零件條件','聯絡資料','最終確認'];
    const prev=form.querySelector('[data-rfq-prev]');
    const next=form.querySelector('[data-rfq-next]');
    const submit=form.querySelector('[data-rfq-submit]');
    const wizardLabel=form.querySelector('[data-wizard-label]');
    const wizardProgress=form.querySelector('[data-wizard-progress]');
    const review=form.querySelector('[data-rfq-review]');
    const copyFallback=form.querySelector('[data-rfq-copy-text]');
    const status=form.querySelector('[data-form-status]');
    let current=0;

    const readEntries=()=>Array.from(new FormData(form).entries());
    const makeText=()=>{
      const lines=['SIGNWELL 欣緯科技｜詢價資料','────────────────────'];
      readEntries().forEach(([key,value])=>lines.push(key+'：'+(String(value).trim()||'未提供')));
      return lines.join('\n');
    };
    const updateReview=()=>{
      if(!review) return;
      review.replaceChildren();
      readEntries().forEach(([label,value])=>{
        const row=document.createElement('div');
        row.className='wizard-review-row';
        const dt=document.createElement('dt');
        const dd=document.createElement('dd');
        dt.textContent=label;
        dd.textContent=String(value).trim()||'未提供';
        row.append(dt,dd);
        review.appendChild(row);
      });
    };
    const showStep=n=>{
      current=Math.max(0,Math.min(steps.length-1,n));
      steps.forEach((step,i)=>{step.hidden=i!==current});
      if(prev) prev.hidden=current===0;
      if(next) next.hidden=current===steps.length-1;
      if(submit) submit.hidden=current!==steps.length-1;
      if(wizardLabel) wizardLabel.textContent='STEP '+String(current+1).padStart(2,'0')+' / 04　'+stepNames[current];
      if(wizardProgress) wizardProgress.style.width=((current+1)/steps.length*100)+'%';
      if(current===steps.length-1) updateReview();
      if(status) status.textContent='';
      if(copyFallback) copyFallback.hidden=true;
      // Avoid jumping the page when the user has not scrolled to the form.
      const rect=form.getBoundingClientRect();
      if(rect.top<0) form.scrollIntoView({behavior:'smooth',block:'start'});
    };
    next?.addEventListener('click',()=>showStep(current+1));
    prev?.addEventListener('click',()=>showStep(current-1));

    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(current!==steps.length-1){showStep(steps.length-1);return;}
      const formatted=makeText();
      if(copyFallback) copyFallback.value=formatted;
      try{
        if(!navigator.clipboard?.writeText) throw new Error('Clipboard not available');
        await navigator.clipboard.writeText(formatted);
        if(status) status.textContent='詢價內容已複製。請貼至你與 SIGNWELL 已確認的聯絡管道；目前沒有自動寄出。';
      }catch{
        if(copyFallback){
          copyFallback.hidden=false;
          copyFallback.focus();
          copyFallback.select();
        }
        if(status) status.textContent='瀏覽器未允許自動複製。已在下方提供文字，請長按選取並手動複製。';
      }
    });
    showStep(0);
  }
});