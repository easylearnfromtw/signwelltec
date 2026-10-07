document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  const page=document.body.dataset.page;
  document.querySelectorAll('.desktop-nav a').forEach(a=>{
    const href=a.getAttribute('href')||'';
    if(page && href.startsWith(page==='home'?'index':page)) a.classList.add('active');
  });

  const toggle=document.querySelector('.menu-toggle');
  const menu=document.querySelector('.mobile-menu');
  if(toggle&&menu){
    toggle.addEventListener('click',()=>{
      const open=menu.classList.toggle('open');
      document.body.classList.toggle('menu-open',open);
      toggle.setAttribute('aria-expanded',String(open));
      menu.setAttribute('aria-hidden',String(!open));
    });
  }

  const reveals=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}});
    },{threshold:.12});
    reveals.forEach(el=>io.observe(el));
  }else reveals.forEach(el=>el.classList.add('visible'));

  const profilePhotos=document.querySelectorAll('img[data-photo="lin-che-wei"]');
  if(profilePhotos.length){
    fetch('assets/people/lin-che-wei.b64',{cache:'force-cache'})
      .then(r=>{if(!r.ok) throw new Error('photo asset unavailable'); return r.text()})
      .then(raw=>{
        const src='data:image/webp;base64,'+raw.trim();
        profilePhotos.forEach(img=>{
          img.src=src;
          img.addEventListener('load',()=>img.closest('.team-card-photo')?.classList.add('loaded'),{once:true});
        });
      })
      .catch(()=>{});
  }

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