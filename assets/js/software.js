/* SIGNWELL Software — continuous isometric camera story */
(function(){
  'use strict';
  const story=document.querySelector('[data-sw-story]');
  const world=document.querySelector('[data-sw-world]');
  if(!story||!world) return;

  const fill=document.querySelector('[data-sw-progress-fill]');
  const label=document.querySelector('[data-sw-progress-label]');
  const hud=document.querySelector('[data-sw-hud]');
  const hudK=document.querySelector('[data-sw-hud-kicker]');
  const hudTitle=document.querySelector('[data-sw-hud-title]');
  const hudBody=document.querySelector('[data-sw-hud-body]');
  const pills=Array.from(document.querySelectorAll('[data-sw-jump]'));
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf=0;

  const stages=[
    {
      key:'office', label:'OFFICE', start:0, end:.29,
      camera:[620,-90,.92],
      kicker:'01 · SOFTWARE DIVISION',
      title:'欣緯軟體',
      body:'欣緯科技旗下部門之一。從辦公室開始，看見設計、內容與程式如何一起完成一個網站產品。'
    },
    {
      key:'road', label:'ROAD / TEAM', start:.29, end:.64,
      camera:[70,-10,.88],
      kicker:'02 · TEAM / ROUTE',
      title:'沿著山路，看見團隊。',
      body:'鏡頭離開辦公室後進入山區道路；兩個看板分別呈現林哲愷與林哲緯的學經歷與專案角色。'
    },
    {
      key:'city', label:'CITY / WORKS', start:.64, end:1,
      camera:[-650,105,.83],
      kicker:'03 · SELECTED WORKS',
      title:'作品進入城市。',
      body:'城市廣告牌就是作品入口。點擊任一看板可先讀專案詳述，再往下查看完整作品集。'
    }
  ];

  function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
  function mix(a,b,t){return a+(b-a)*t}
  function smooth(t){t=clamp(t);return t*t*(3-2*t)}
  function factor(){
    const w=window.innerWidth;
    if(w<560) return .61;
    if(w<900) return .72;
    if(w<1200) return .84;
    return 1;
  }
  function cameraAt(p){
    const hold1=.19, trans1=.34, hold2=.49, trans2=.68;
    const a=stages[0].camera,b=stages[1].camera,c=stages[2].camera;
    let x,y,s;
    if(p<=hold1){[x,y,s]=a}
    else if(p<trans1){
      const t=smooth((p-hold1)/(trans1-hold1));
      x=mix(a[0],b[0],t);y=mix(a[1],b[1],t);s=mix(a[2],b[2],t);
    }else if(p<=hold2){[x,y,s]=b}
    else if(p<trans2){
      const t=smooth((p-hold2)/(trans2-hold2));
      x=mix(b[0],c[0],t);y=mix(b[1],c[1],t);s=mix(b[2],c[2],t);
    }else{[x,y,s]=c}
    return [x,y,s*factor()];
  }
  function stageAt(p){
    if(p<.31)return stages[0];
    if(p<.64)return stages[1];
    return stages[2];
  }
  let activeStage='';
  function setStage(stage){
    if(!stage||activeStage===stage.key)return;
    activeStage=stage.key;
    if(label)label.textContent=stage.label;
    if(hud){
      hud.dataset.stage=stage.key;
      hud.animate&&hud.animate([{opacity:.78,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
    }
    if(hudK)hudK.textContent=stage.kicker;
    if(hudTitle){
      hudTitle.textContent=stage.title;
      hudTitle.tagName==='H1';
    }
    if(hudBody)hudBody.textContent=stage.body;
    pills.forEach(b=>b.classList.toggle('is-active',b.dataset.swJump===stage.key));
  }
  function render(){
    raf=0;
    const r=story.getBoundingClientRect();
    const max=Math.max(1,story.offsetHeight-window.innerHeight);
    const p=clamp(-r.top/max);
    if(fill)fill.style.width=(p*100).toFixed(2)+'%';
    const [x,y,s]=cameraAt(reduce?(p<.31?0:p<.64?.42:1):p);
    world.style.transform='translate3d(calc(-50% + '+x.toFixed(1)+'px),calc(-50% + '+y.toFixed(1)+'px),0) scale('+s.toFixed(4)+')';
    setStage(stageAt(p));
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(render)}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  render();

  const stageTarget={office:.02,road:.40,city:.78};
  pills.forEach(btn=>btn.addEventListener('click',()=>{
    const p=stageTarget[btn.dataset.swJump]||0;
    const max=Math.max(1,story.offsetHeight-window.innerHeight);
    const top=window.scrollY+story.getBoundingClientRect().top+p*max;
    window.scrollTo({top,behavior:reduce?'auto':'smooth'});
  }));

  const projects={
    chekai:{k:'PERSONAL WEBSITE',t:'林哲愷｜個人網站製作',b:'以個人形象為核心，整合履歷、活動、作品與觀點。重點不是把資料平鋪成履歷，而是把經歷變成可以探索的空間：場景式導覽、活動節點、互動頁面與持續擴充的內容結構。',l:[['開啟網站','https://easylearnfromtw.github.io/test/chekai-portfolio/']]},
    taiwanway:{k:'EDTECH / GAMEFUL LEARNING',t:'閒台文 Tai-Wan Way',b:'以外國人學中文為核心，整合闖關鑰匙、魔王關、證書、語音多聲線、背景音樂、收藏與進度系統。網站本身是一個可持續擴充的學習世界，而不是單純教材頁。',l:[['開啟網站','https://easylearnfromtw.github.io/Taiwanway/']]},
    bio:{k:'PUBLIC + CMS + AI',t:'SIGNWELL 欣緯生醫',b:'完整架構包含 Public 公開站、CMS 後台、文章草稿／發布、圖片管理、主題分類、瀏覽數據與電子報工作流，並把 AI 輔助內容整理與管理流程串在同一套系統裡。',l:[['品牌網域','https://signwell.com.tw']]},
    citymus:{k:'INTERACTIVE MUSIC WORLD',t:'CITYMUS',b:'以城市、音樂與互動節奏為核心的場景式網站。內容不是用一般區塊堆疊，而是透過移動、路線、視覺節奏與介面層次，讓使用者像在一個音樂城市裡探索。',l:[['開啟網站','https://easylearnfromtw.github.io/musictown/']]},
    laoshan:{k:'STORY WORLD / WEB GAME',t:'勞山道士',b:'以世界觀、場景與氣氛為核心的互動式網頁遊戲專案，著重畫面敘事、視覺節奏與可探索感。',l:[['專案庫','https://easylearnfromtw.github.io/musictown/']]},
    vincent:{k:'CONTENT / BRAND SYSTEM',t:'Vincent Project Series',b:'以個人品牌、醫學與投資內容、專業形象及互動工具為核心的系列專案。包含 Vincent’s Note、Vincent Aesthetic Lab 等方向。',l:[['Vincent’s Note','https://vincents-note.pages.dev']]}
  };
  const dialog=document.querySelector('[data-sw-dialog]');
  const dk=document.querySelector('[data-sw-dialog-kicker]');
  const dt=document.querySelector('[data-sw-dialog-title]');
  const db=document.querySelector('[data-sw-dialog-body]');
  const dl=document.querySelector('[data-sw-dialog-links]');
  function openProject(key){
    const p=projects[key];if(!p||!dialog)return;
    if(dk)dk.textContent=p.k;if(dt)dt.textContent=p.t;if(db)db.textContent=p.b;
    if(dl)dl.innerHTML=p.l.map(([n,u])=>'<a href="'+u+'" target="_blank" rel="noopener">'+n+' ↗</a>').join('');
    dialog.showModal?dialog.showModal():dialog.setAttribute('open','');
  }
  document.addEventListener('click',e=>{
    const project=e.target.closest&&e.target.closest('[data-sw-project]');
    if(project){openProject(project.dataset.swProject);return}
    const close=e.target.closest&&e.target.closest('[data-sw-dialog-close]');
    if(close&&dialog){dialog.close?dialog.close():dialog.removeAttribute('open');return}
    const ret=e.target.closest&&e.target.closest('[data-sw-return]');
    if(ret){
      e.preventDefault();
      const url=new URL(ret.href,location.href);
      try{sessionStorage.setItem('sw-nav-enter','backward');sessionStorage.setItem('sw-nav-color','#0a0a0b')}catch{}
      document.documentElement.dataset.navDir='backward';
      document.documentElement.style.setProperty('--sw-nav-color','#0a0a0b');
      document.documentElement.classList.add('is-page-leaving');
      requestAnimationFrame(()=>setTimeout(()=>location.assign(url.href),120));
    }
  });
})();