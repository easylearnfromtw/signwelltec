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

  // Filter public part references in the browser. No data leaves this page.
  const partSearch=document.querySelector('[data-part-search]');
  if(partSearch){
    const records=[...document.querySelectorAll('[data-part-list] .part-reference-item')];
    const count=document.querySelector('[data-part-count]');
    const empty=document.querySelector('[data-part-empty]');
    const normalize=value=>String(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
    const applySearch=()=>{
      const keyword=normalize(partSearch.value);
      let shown=0;
      records.forEach(item=>{
        const matches=!keyword||normalize(item.textContent).includes(keyword);
        item.hidden=!matches;
        if(matches) shown++;
      });
      if(count) count.textContent='顯示 '+shown+' / '+records.length+' 項料號';
      if(empty) empty.hidden=shown>0;
    };
    partSearch.addEventListener('input',applySearch);
    applySearch();
  }


  // Gmail draft integration for a static GitHub Pages website:
  // Gmail compose links only support plain-text bodies. HTML preview may be
  // copied as rich clipboard content, then manually pasted into Gmail.
  const form=document.querySelector('[data-rfq-form]');
  if(form){
    const gmailRecipient='signwell.com.tw@gmail.com';
    const steps=[...form.querySelectorAll('[data-rfq-step]')];
    const stepNames=['需求類型','零件條件','聯絡資料','最終確認'];
    const prev=form.querySelector('[data-rfq-prev]');
    const next=form.querySelector('[data-rfq-next]');
    const submit=form.querySelector('[data-rfq-submit]');
    const copyHtmlButton=form.querySelector('[data-rfq-copy-html]');
    const wizardLabel=form.querySelector('[data-wizard-label]');
    const wizardProgress=form.querySelector('[data-wizard-progress]');
    const mailPreview=form.querySelector('[data-rfq-mail-preview]');
    const copyFallback=form.querySelector('[data-rfq-copy-text]');
    const status=form.querySelector('[data-form-status]');
    let current=0;

    // Product links prefill public part specifications, never a customer's data.
    const params=new URLSearchParams(window.location.search);
    const queryPart=(params.get('part')||'').trim().slice(0,120);
    const querySpec=(params.get('spec')||'').trim().slice(0,240);
    if(queryPart){
      const partInput=form.querySelector('[name="料號"]');
      const specInput=form.querySelector('[name="規格與限制條件"]');
      const otherType=form.querySelector('[name="需求類型"][value="其他料件／專案"]');
      if(partInput) partInput.value=queryPart;
      if(specInput && querySpec) specInput.value=querySpec;
      if(otherType) otherType.checked=true;
      const notice=form.querySelector('[data-rfq-prefill]');
      if(notice){
        notice.textContent='已代入料號 '+queryPart+'；可繼續補充數量、製造商與需求條件。';
        notice.hidden=false;
      }
    }

    const orderedFields=['需求類型','料號','製造商','數量','時程','規格與限制條件','詢價公司','聯絡人','聯絡方式','其他需求'];
    const readEntries=()=>{
      const fields=new Map(new FormData(form).entries());
      return orderedFields.map(key=>[key,String(fields.get(key)||'').trim()||'未提供']);
    };
    const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
    const makeText=()=>{
      const lines=['SIGNWELL 欣緯科技｜電子零件詢價','收件人：'+gmailRecipient,'────────────────────'];
      readEntries().forEach(([key,value])=>lines.push(key+'：'+value));
      lines.push('────────────────────');
      lines.push('請協助確認所需料件的規格、詢價條件與後續溝通事項。');
      return lines.join('\n');
    };
    const subject=()=>{
      const part=form.querySelector('[name="料號"]')?.value.trim();
      const type=form.querySelector('input[name="需求類型"]:checked')?.value||'電子零件';
      return 'SIGNWELL 詢價｜'+(part||type);
    };
    // Adapted from the SIGN WELL biomedical Sky Glass newsletter visual language.
    // All text, branding and user data are customized for SIGNWELL technology.
    const makeMailMarkup=()=>{
      const rows=readEntries().map(([key,value],index)=>{
        const bgcolor=index%2?'#F4FAFE':'#FFFFFF';
        return '<tr><td valign="top" bgcolor="'+bgcolor+'" style="width:34%;padding:12px 10px;border-bottom:1px solid #E1EDF5;color:#65859B;font:700 11px/1.65 -apple-system,BlinkMacSystemFont,Arial,sans-serif;overflow-wrap:anywhere">'+escapeHtml(key)+'</td>'+
          '<td valign="top" bgcolor="'+bgcolor+'" style="padding:12px 10px;border-bottom:1px solid #E1EDF5;color:#193A53;font:600 13px/1.65 -apple-system,BlinkMacSystemFont,Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap">'+escapeHtml(value)+'</td></tr>';
      }).join('');
      return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#EAF6FF" style="width:100%;margin:0;padding:0;table-layout:fixed;border-collapse:collapse;background-color:#EAF6FF;background-image:linear-gradient(150deg,#F5FBFF 0%,#D7EFFF 65%,#B9DFF7 100%)">'+
        '<tr><td align="center" style="padding:20px 12px 34px">'+
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;table-layout:fixed;border-collapse:separate;border-spacing:0">'+
        '<tr><td style="padding:32px 26px 60px;border:1px solid #CBEAFB;border-radius:28px 28px 18px 18px;background-color:#79BBE9;background-image:linear-gradient(145deg,#A5DAF7 0%,#75BDEE 50%,#568FC9 100%)">'+
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed"><tr><td>'+
        '<div style="color:#FFFFFF;font:800 11px/1.4 -apple-system,BlinkMacSystemFont,Arial,sans-serif;letter-spacing:.16em">SIGNWELL / BUSINESS ENQUIRY</div>'+
        '<div style="margin-top:5px;color:#ECFAFF;font:600 12px/1.5 -apple-system,BlinkMacSystemFont,Arial,sans-serif">欣緯科技有限公司 · 電子零件採購需求</div>'+
        '</td><td align="right" valign="top" style="width:48px"><span style="display:inline-block;width:42px;height:42px;border-radius:21px;background:#FFD84D;border:1px solid #FFF2B2;color:#151515;font:800 13px/42px Arial,sans-serif;text-align:center">SW</span></td></tr></table>'+
        '<h1 style="margin:38px 0 0;color:#FFFFFF;font:800 33px/1.17 -apple-system,BlinkMacSystemFont,Arial,sans-serif;letter-spacing:-.025em">零件詢價 · 需求明細</h1>'+
        '<p style="margin:12px 0 0;color:#EDF9FF;font:700 10px/1.5 Arial,sans-serif;letter-spacing:.14em">COMPONENTS / RFQ</p>'+
        '</td></tr>'+
        '<tr><td style="padding:0 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;margin-top:-30px;border:1px solid #FFFFFF;border-radius:24px;background:#F8FCFF;box-shadow:0 18px 35px rgba(42,102,148,.12)">'+
        '<tr><td style="padding:28px 20px 24px">'+
        '<div style="display:inline-block;padding:7px 10px;border:1px solid #D8EAF6;border-radius:30px;background:#E5F4FD;color:#3475A2;font:800 10px/1.3 Arial,sans-serif;letter-spacing:.1em">SIGNWELL · REQUEST DETAILS</div>'+
        '<p style="margin:18px 0 16px;color:#5D7890;font:500 13px/1.8 -apple-system,BlinkMacSystemFont,Arial,sans-serif">您好，以下為本次電子零件詢價需求，敬請協助確認相關規格與商務條件。</p>'+
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse">'+rows+'</table>'+
        '<p style="margin:20px 0 0;color:#5D7890;font:500 12px/1.8 -apple-system,BlinkMacSystemFont,Arial,sans-serif">此信件由詢價人確認後寄出。實際報價、數量與供貨條件仍須另行確認。</p>'+
        '</td></tr></table></td></tr>'+
        '<tr><td align="center" style="padding:28px 16px 10px;color:#6D8AA0;font:600 11px/1.7 Arial,sans-serif">SIGNWELL · 欣緯科技<br>TECHNOLOGY & COMPONENTS</td></tr>'+
        '</table></td></tr></table>';
    };
    const makeMailDocument=()=>'<html lang="zh-Hant"><head><meta charset="utf-8"></head><body style="margin:0;background:#EAF6FF">'+makeMailMarkup()+'</body></html>';
    const updatePreview=()=>{
      if(mailPreview) mailPreview.innerHTML=makeMailMarkup();
    };
    const showStep=n=>{
      current=Math.max(0,Math.min(steps.length-1,n));
      steps.forEach((step,i)=>{step.hidden=i!==current});
      if(prev) prev.hidden=current===0;
      if(next) next.hidden=current===steps.length-1;
      if(submit) submit.hidden=current!==steps.length-1;
      if(copyHtmlButton) copyHtmlButton.hidden=current!==steps.length-1;
      if(wizardLabel) wizardLabel.textContent='STEP '+String(current+1).padStart(2,'0')+' / 04　'+stepNames[current];
      if(wizardProgress) wizardProgress.style.width=((current+1)/steps.length*100)+'%';
      if(current===steps.length-1) updatePreview();
      if(status) status.textContent='';
      if(copyFallback) copyFallback.hidden=true;
      const rect=form.getBoundingClientRect();
      if(rect.top<0) form.scrollIntoView({behavior:'smooth',block:'start'});
    };
    next?.addEventListener('click',()=>showStep(current+1));
    prev?.addEventListener('click',()=>showStep(current-1));
    copyHtmlButton?.addEventListener('click',async()=>{
      updatePreview();
      const html=makeMailDocument();
      const text=makeText();
      try{
        if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined') throw new Error('Rich clipboard is unavailable');
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':new Blob([html],{type:'text/html'}),
          'text/plain':new Blob([text],{type:'text/plain'})
        })]);
        if(status) status.textContent='已複製 HTML 排版。按「傳送」開啟 Gmail，將預填的純文字內文全選後貼上，即可使用此版型。';
      }catch{
        try{
          if(!navigator.clipboard?.writeText) throw new Error('No clipboard access');
          await navigator.clipboard.writeText(text);
          if(status) status.textContent='此瀏覽器不支援複製 HTML，已改為複製純文字；按「傳送」可直接開啟 Gmail 草稿。';
        }catch{
          if(copyFallback){copyFallback.hidden=false;copyFallback.value=text;copyFallback.focus();copyFallback.select();}
          if(status) status.textContent='瀏覽器未允許存取剪貼簿。下方已顯示純文字內容供手動複製。';
        }
      }
    });
    form.addEventListener('submit',e=>{
      e.preventDefault();
      if(current!==steps.length-1){showStep(steps.length-1);return;}
      const compose=new URL('https://mail.google.com/mail/');
      compose.searchParams.set('view','cm');
      compose.searchParams.set('fs','1');
      compose.searchParams.set('to',gmailRecipient);
      compose.searchParams.set('su',subject());
      compose.searchParams.set('body',makeText());
      if(status) status.textContent='正在開啟 Gmail 草稿；請在 Gmail 中確認後自行寄出。';
      window.location.assign(compose.toString());
    });
    showStep(0);
  }
});