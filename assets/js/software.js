/* SIGNWELL Software — cinematic scroll camera */
(function(){
  'use strict';

  const story=document.querySelector('[data-sw-story]');
  const world=document.querySelector('[data-sw-world]');
  const camera=document.querySelector('.sw-camera');
  if(!story||!world) return;

  const fill=document.querySelector('[data-sw-progress-fill]');
  const label=document.querySelector('[data-sw-progress-label]');
  const hud=document.querySelector('[data-sw-hud]');
  const hudK=document.querySelector('[data-sw-hud-kicker]');
  const hudTitle=document.querySelector('[data-sw-hud-title]');
  const hudBody=document.querySelector('[data-sw-hud-body]');
  const pills=Array.from(document.querySelectorAll('[data-sw-jump]'));
  const officeShell=document.querySelector('[data-sw-office-shell]');
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stageCopy={
    exterior:{
      nav:'office',label:'OFFICE / EXTERIOR',
      kicker:'01 · SOFTWARE DIVISION',
      title:'欣緯軟體',
      body:'鏡頭先停在辦公園區外部，再向建築推進；不是切換頁面，而是在同一個模型世界裡移動。'
    },
    interior:{
      nav:'office',label:'OFFICE / INSIDE',
      kicker:'01B · INSIDE THE STUDIO',
      title:'進入工作現場。',
      body:'屋頂在鏡頭推近時逐步打開，讓辦公桌、筆電與工作空間成為下一個畫面焦點。'
    },
    road:{
      nav:'road',label:'TEAM ROUTE',
      kicker:'02 · TEAM / ROUTE',
      title:'沿著山路，看見團隊。',
      body:'鏡頭從辦公室拉遠，沿著蜿蜒道路移動到山區；人物學經歷成為路線上的實體看板。'
    },
    city:{
      nav:'city',label:'WORKS CITY',
      kicker:'03 · SELECTED WORKS',
      title:'最後進入作品城市。',
      body:'鏡頭再度推近城市。每一塊城市看板都是作品入口，可直接開啟專案詳述。'
    }
  };

  // Keyframes intentionally contain flat sections. Those pauses recreate the
  // "arrive -> inspect -> move again" rhythm in the supplied reference video.
  const photoKeys=[
    {p:0.00,x:0,y:120,s:.92,b:1.00},
    {p:0.10,x:0,y:120,s:.92,b:1.00},
    {p:0.20,x:-8,y:245,s:1.26,b:1.03},
    {p:0.31,x:-8,y:245,s:1.26,b:1.03},
    {p:0.43,x:92,y:-32,s:1.18,b:1.02},
    {p:0.55,x:92,y:-32,s:1.18,b:1.02},
    {p:0.66,x:30,y:-100,s:1.23,b:1.02},
    {p:0.78,x:-120,y:-178,s:1.31,b:1.01},
    {p:1.00,x:-120,y:-178,s:1.31,b:1.01}
  ];

  const keys=[
    {p:0.00,x:620,y:-88,s:.91,r:-.35,stage:'exterior'},
    {p:0.10,x:620,y:-88,s:.91,r:-.35,stage:'exterior'},

    {p:0.19,x:790,y:-175,s:1.22,r:.10,stage:'interior'},
    {p:0.31,x:790,y:-175,s:1.22,r:.10,stage:'interior'},

    {p:0.43,x:115,y:-12,s:.84,r:-.72,stage:'road'},
    {p:0.53,x:115,y:-12,s:.84,r:-.72,stage:'road'},
    {p:0.62,x:-95,y:28,s:.90,r:.40,stage:'road'},

    {p:0.74,x:-620,y:108,s:.84,r:-.36,stage:'city'},
    {p:0.83,x:-755,y:48,s:1.04,r:.08,stage:'city'},
    {p:1.00,x:-755,y:48,s:1.04,r:.08,stage:'city'}
  ];

  function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
  function mix(a,b,t){return a+(b-a)*t}
  function ease(t){
    t=clamp(t);
    return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
  }
  function viewportFactor(){
    const w=window.innerWidth;
    if(w<430)return .62;
    if(w<560)return .66;
    if(w<900)return .76;
    if(w<1200)return .86;
    return 1;
  }
  function photoAt(p){
    let a=photoKeys[0],b=photoKeys[photoKeys.length-1];
    for(let i=0;i<photoKeys.length-1;i++){
      if(p>=photoKeys[i].p&&p<=photoKeys[i+1].p){a=photoKeys[i];b=photoKeys[i+1];break}
    }
    const raw=b.p===a.p?1:(p-a.p)/(b.p-a.p);
    const t=ease(raw);
    const mobile=window.innerWidth<760;
    const x=mix(a.x,b.x,t)*(mobile?1.12:1);
    const y=mix(a.y,b.y,t)*(mobile?1.08:1);
    const s=mix(a.s,b.s,t)*(mobile?1.02:1);
    return {x,y,s,b:mix(a.b,b.b,t)};
  }

  function cameraAt(p){
    let a=keys[0],b=keys[keys.length-1];
    for(let i=0;i<keys.length-1;i++){
      if(p>=keys[i].p&&p<=keys[i+1].p){a=keys[i];b=keys[i+1];break}
    }
    const raw=b.p===a.p?1:(p-a.p)/(b.p-a.p);
    const t=ease(raw);
    const f=viewportFactor();
    return {
      x:mix(a.x,b.x,t)*f,
      y:mix(a.y,b.y,t)*f,
      s:mix(a.s,b.s,t)*f,
      r:mix(a.r,b.r,t),
      stage:raw<.5?a.stage:b.stage
    };
  }
  function stageAt(p){
    if(p<.145)return 'exterior';
    if(p<.355)return 'interior';
    if(p<.695)return 'road';
    return 'city';
  }

  let storyTop=0;
  let storyRange=1;
  let targetP=0;
  let visualP=0;
  let running=false;
  let activeStage='';

  function measure(){
    const vh=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
    storyTop=window.scrollY+story.getBoundingClientRect().top;
    storyRange=Math.max(1,story.offsetHeight-vh);
    targetP=clamp((window.scrollY-storyTop)/storyRange);
    if(reduce)visualP=targetP;
  }

  function setStage(key){
    if(activeStage===key)return;
    activeStage=key;
    const stage=stageCopy[key];
    if(!stage)return;

    world.dataset.focus=key;
    if(hud)hud.dataset.stage=key;
    if(label)label.textContent=stage.label;
    if(hudK)hudK.textContent=stage.kicker;
    if(hudTitle)hudTitle.textContent=stage.title;
    if(hudBody)hudBody.textContent=stage.body;

    pills.forEach(btn=>btn.classList.toggle('is-active',btn.dataset.swJump===stage.nav));

    if(hud&&hud.animate&&!reduce){
      hud.animate(
        [{opacity:.82,transform:'translate3d(0,6px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],
        {duration:280,easing:'cubic-bezier(.16,1,.3,1)'}
      );
    }
  }

  function render(p){
    if(fill)fill.style.width=(p*100).toFixed(2)+'%';

    const cam=cameraAt(p);
    const photoCam=photoAt(p);
    if(camera){
      camera.style.setProperty('--photo-x',photoCam.x.toFixed(1)+'px');
      camera.style.setProperty('--photo-y',photoCam.y.toFixed(1)+'px');
      camera.style.setProperty('--photo-s',photoCam.s.toFixed(4));
      camera.style.setProperty('--photo-brightness',photoCam.b.toFixed(3));
    }
    world.style.transform=
      'translate3d(calc(-50% + '+cam.x.toFixed(1)+'px),calc(-50% + '+cam.y.toFixed(1)+'px),0) '+
      'scale('+cam.s.toFixed(4)+') rotateZ('+cam.r.toFixed(3)+'deg)';

    const stage=stageAt(p);
    setStage(stage);

    // Exterior shell fades only while the camera physically enters the office.
    if(officeShell){
      const fade=clamp((p-.105)/.075);
      officeShell.style.opacity=(1-ease(fade)).toFixed(3);
      officeShell.style.pointerEvents='none';
    }
  }

  function tick(){
    if(reduce){
      visualP=targetP;
    }else{
      // Small cinematic inertia: camera keeps moving for a fraction after the finger stops.
      visualP += (targetP-visualP)*.135;
      if(Math.abs(targetP-visualP)<.00015)visualP=targetP;
    }

    render(visualP);

    if(Math.abs(targetP-visualP)>.00015){
      requestAnimationFrame(tick);
    }else{
      running=false;
    }
  }
  function start(){
    if(running)return;
    running=true;
    requestAnimationFrame(tick);
  }
  function onScroll(){
    targetP=clamp((window.scrollY-storyTop)/storyRange);
    start();
  }

  measure();
  visualP=targetP;
  render(visualP);

  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',()=>{measure();start()},{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',()=>{measure();start()},{passive:true});
  }

  const stageTarget={office:.04,road:.47,city:.82};
  pills.forEach(btn=>btn.addEventListener('click',()=>{
    const p=stageTarget[btn.dataset.swJump]||0;
    window.scrollTo({
      top:storyTop+p*storyRange,
      behavior:reduce?'auto':'smooth'
    });
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
    const p=projects[key];
    if(!p||!dialog)return;
    if(dk)dk.textContent=p.k;
    if(dt)dt.textContent=p.t;
    if(db)db.textContent=p.b;
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
      try{
        sessionStorage.setItem('sw-nav-enter','backward');
        sessionStorage.setItem('sw-nav-color','#0a0a0b');
      }catch{}
      document.documentElement.dataset.navDir='backward';
      document.documentElement.style.setProperty('--sw-nav-color','#0a0a0b');
      document.documentElement.classList.add('is-page-leaving');
      requestAnimationFrame(()=>setTimeout(()=>location.assign(url.href),120));
    }
  });
})();