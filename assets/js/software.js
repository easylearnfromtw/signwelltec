/* SIGNWELL Software — scroll camera + project details */
(function(){
  'use strict';

  const story=document.querySelector('[data-sw-story]');
  if(!story) return;

  const office=document.querySelector('[data-sw-scene="office"]');
  const road=document.querySelector('[data-sw-scene="road"]');
  const city=document.querySelector('[data-sw-scene="city"]');
  const officeModel=document.querySelector('[data-sw-office]');
  const fill=document.querySelector('[data-sw-progress-fill]');
  const label=document.querySelector('[data-sw-progress-label]');
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf=0;

  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const range=(p,a,b)=>clamp((p-a)/(b-a));
  function fadeWindow(p,a,b,c,d){
    if(p<a||p>d) return 0;
    if(p<b) return range(p,a,b);
    if(p>c) return 1-range(p,c,d);
    return 1;
  }

  function render(){
    raf=0;
    const r=story.getBoundingClientRect();
    const max=Math.max(1,story.offsetHeight-window.innerHeight);
    const p=clamp(-r.top/max);

    if(fill) fill.style.width=(p*100).toFixed(2)+'%';
    if(label) label.textContent=p<.29?'OFFICE':p<.63?'ROAD':'CITY';

    if(reduce){
      office.style.opacity=p<.34?'1':'0';
      road.style.opacity=p>=.30&&p<.68?'1':'0';
      city.style.opacity=p>=.64?'1':'0';
      return;
    }

    const o=fadeWindow(p,0,.02,.22,.34);
    const rd=fadeWindow(p,.24,.34,.54,.67);
    const c=fadeWindow(p,.57,.68,.91,1);

    office.style.opacity=o.toFixed(3);
    road.style.opacity=rd.toFixed(3);
    city.style.opacity=c.toFixed(3);

    office.style.transform='translate3d(0,'+(-range(p,0,.34)*4.5).toFixed(2)+'vh,0) scale('+(1-range(p,0,.34)*.022).toFixed(4)+')';
    road.style.transform='translate3d(0,'+((.48-p)*5).toFixed(2)+'vh,0) scale('+(0.975+range(p,.24,.67)*.025).toFixed(4)+')';
    city.style.transform='translate3d(0,'+((.79-p)*4.5).toFixed(2)+'vh,0) scale('+(0.982+range(p,.57,1)*.018).toFixed(4)+')';

    if(officeModel){
      const t=range(p,.04,.33);
      officeModel.style.transform='translate3d(0,'+(-t*3.4).toFixed(2)+'vh,0) scale('+(1+t*.025).toFixed(4)+')';
    }

    [[office,o],[road,rd],[city,c]].forEach(([el,val])=>{
      if(el) el.classList.toggle('is-active',val>.58);
    });
  }

  function schedule(){
    if(!raf) raf=requestAnimationFrame(render);
  }
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  render();

  const projects={
    chekai:{
      kicker:'PERSONAL WEBSITE',
      title:'林哲愷｜個人網站製作',
      body:'以個人形象為核心，整合履歷、活動、作品與觀點。重點不是把資料平鋪成履歷，而是把經歷變成可以探索的空間：場景式導覽、活動節點、互動頁面與持續擴充的內容結構。',
      links:[['開啟網站','https://easylearnfromtw.github.io/test/chekai-portfolio/']]
    },
    taiwanway:{
      kicker:'EDTECH / GAMEFUL LEARNING',
      title:'閒台文 Tai-Wan Way',
      body:'以外國人學中文為核心，整合闖關鑰匙、魔王關、證書、語音多聲線、背景音樂、收藏與進度系統。網站本身是一個可持續擴充的學習世界，而不是單純教材頁。',
      links:[['開啟網站','https://easylearnfromtw.github.io/Taiwanway/']]
    },
    bio:{
      kicker:'PUBLIC + CMS + AI',
      title:'SIGNWELL 欣緯生醫',
      body:'完整架構包含 Public 公開站、CMS 後台、文章草稿／發布、圖片管理、主題分類、瀏覽數據與電子報工作流，並把 AI 輔助內容整理與管理流程串在同一套系統裡。作品展示採系統架構與最新檔案介面示意，不使用單純首頁截圖。',
      links:[['品牌網域','https://signwell.com.tw']]
    },
    citymus:{
      kicker:'INTERACTIVE MUSIC WORLD',
      title:'CITYMUS',
      body:'以城市、音樂與互動節奏為核心的場景式網站。內容不是用一般區塊堆疊，而是透過移動、路線、視覺節奏與介面層次，讓使用者像在一個音樂城市裡探索。',
      links:[['開啟網站','https://easylearnfromtw.github.io/musictown/']]
    },
    laoshan:{
      kicker:'STORY WORLD / WEB GAME',
      title:'勞山道士',
      body:'以世界觀、場景與氣氛為核心的互動式網頁遊戲專案，著重畫面敘事、視覺節奏與可探索感。專案目前與 CITYMUS 同一專案庫持續整理。',
      links:[['開啟專案庫','https://easylearnfromtw.github.io/musictown/']]
    },
    vincent:{
      kicker:'CONTENT / BRAND SYSTEM',
      title:'Vincent Project Series',
      body:'以個人品牌、醫學與投資內容、專業形象及互動工具為核心的系列專案。包含 Vincent’s Note、Vincent Aesthetic Lab 等方向，重點是把內容、視覺與工具整合成可持續擴張的品牌系統。',
      links:[['Vincent’s Note','https://vincents-note.pages.dev']]
    }
  };

  const dialog=document.querySelector('[data-sw-dialog]');
  const kicker=document.querySelector('[data-sw-dialog-kicker]');
  const title=document.querySelector('[data-sw-dialog-title]');
  const body=document.querySelector('[data-sw-dialog-body]');
  const links=document.querySelector('[data-sw-dialog-links]');

  function openProject(key){
    const p=projects[key];
    if(!p||!dialog) return;
    if(kicker) kicker.textContent=p.kicker;
    if(title) title.textContent=p.title;
    if(body) body.textContent=p.body;
    if(links){
      links.innerHTML=p.links.map(([name,url])=>'<a href="'+url+'" target="_blank" rel="noopener">'+name+' ↗</a>').join('');
    }
    if(typeof dialog.showModal==='function') dialog.showModal();
    else dialog.setAttribute('open','');
  }

  document.addEventListener('click',event=>{
    const p=event.target.closest&&event.target.closest('[data-sw-project]');
    if(p){openProject(p.dataset.swProject);return;}

    const close=event.target.closest&&event.target.closest('[data-sw-dialog-close]');
    if(close&&dialog){
      dialog.close?dialog.close():dialog.removeAttribute('open');
      return;
    }

    const ret=event.target.closest&&event.target.closest('[data-sw-return]');
    if(ret){
      event.preventDefault();
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

  if(dialog){
    dialog.addEventListener('click',event=>{
      const r=dialog.getBoundingClientRect();
      const inside=event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;
      if(!inside) dialog.close();
    });
  }
})();