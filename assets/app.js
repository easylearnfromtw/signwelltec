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
    const gmailRecipientLabel='signwell.com.tw';
    const steps=[...form.querySelectorAll('[data-rfq-step]')];
    const stepNames=['需求類型','零件條件','聯絡資料','最終確認'];
    const prev=form.querySelector('[data-rfq-prev]');
    const next=form.querySelector('[data-rfq-next]');
    const submit=form.querySelector('[data-rfq-submit]');
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
      const fields=new Map(readEntries());
      const part=fields.get('料號');
      const type=fields.get('需求類型');
      const displayPart=part&&part!=='未提供'?part:'';
      const displayType=type&&type!=='未提供'?type:'電子零件';
      const mailTitle=displayPart?'零件詢價｜'+displayPart:'新的'+displayType+'詢價';
      const rows=readEntries().map(([key,value])=>{
        return '<tr>'+
          '<td valign="top" style="width:31%;padding:13px 10px 13px 0;border-bottom:1px solid #E4E9ED;color:#7E919F;font:700 11px/1.65 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;overflow-wrap:anywhere">'+escapeHtml(key)+'</td>'+
          '<td valign="top" style="padding:13px 0 13px 10px;border-bottom:1px solid #E4E9ED;color:#172631;font:600 13px/1.7 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap">'+escapeHtml(value)+'</td>'+
        '</tr>';
      }).join('');
      return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#EEF3F6" style="width:100%;margin:0;padding:0;table-layout:fixed;border-collapse:collapse;background:#EEF3F6">'+
        '<tr><td align="center" style="padding:32px 14px 42px">'+
          '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:650px;table-layout:fixed;border-collapse:separate;border-spacing:0;background:#FFFFFF;border:1px solid #E1E8EC;border-radius:30px">'+
            '<tr><td style="padding:48px 46px 42px">'+
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed"><tr>'+
                '<td>'+
                  '<div style="color:#7990A0;font:800 11px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;letter-spacing:.18em">SIGNWELL · BUSINESS INBOX</div>'+
                '</td>'+
                '<td align="right" valign="top" style="width:48px">'+
                  '<span style="display:inline-block;width:14px;height:14px;background:#FFD84D;border-radius:2px"></span>'+
                '</td>'+
              '</tr></table>'+
              '<h1 style="margin:26px 0 0;color:#172631;font:800 38px/1.18 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;letter-spacing:-.035em">'+escapeHtml(mailTitle)+'</h1>'+
              '<p style="margin:22px 0 0;color:#778A98;font:500 15px/1.85 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">'+
                '以下為 SIGNWELL 網站整理的詢價內容，敬請協助確認料件規格、數量與相關商務條件。'+
              '</p>'+
              '<div style="height:1px;margin:30px 0 0;background:#E2E8EC"></div>'+
              '<div style="margin-top:28px;color:#172631;font:800 20px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">需求明細</div>'+
              '<div style="margin-top:6px;color:#81929E;font:500 12px/1.7 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">REQUEST DETAILS · '+escapeHtml(displayType)+'</div>'+
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;margin-top:18px;border-collapse:collapse">'+rows+'</table>'+
              '<div style="margin-top:26px;padding:18px 20px;border-radius:16px;background:#F5F8FA;color:#718491;font:500 12px/1.8 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif">'+
                '此郵件由詢價人確認後寄出。網站顯示之料號與規格不代表即時庫存或正式報價，實際供應條件仍須另行確認。'+
              '</div>'+
              '<div style="margin-top:34px;padding-top:22px;border-top:1px solid #E2E8EC;color:#8C9BA5;font:700 10px/1.8 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;letter-spacing:.08em">'+
                'SIGNWELL · 欣緯科技有限公司<br>TECHNOLOGY · COMPONENTS · SOURCING'+
              '</div>'+
            '</td></tr>'+
          '</table>'+
        '</td></tr>'+
      '</table>';
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
    const copyRichMail=async()=>{
      updatePreview();
      const html=makeMailDocument();
      const text=makeText();
      try{
        if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined') throw new Error('Rich clipboard unavailable');
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':new Blob([html],{type:'text/html'}),
          'text/plain':new Blob([text],{type:'text/plain'})
        })]);
        return true;
      }catch{
        try{
          const holder=document.createElement('div');
          holder.contentEditable='true';
          holder.setAttribute('aria-hidden','true');
          holder.style.position='fixed';
          holder.style.left='-99999px';
          holder.style.top='0';
          holder.innerHTML=html;
          document.body.appendChild(holder);
          const range=document.createRange();
          range.selectNodeContents(holder);
          const selection=window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          const ok=document.execCommand('copy');
          selection.removeAllRanges();
          holder.remove();
          return !!ok;
        }catch{
          return false;
        }
      }
    };

    const copyRichMailSync=()=>{
      const html=makeMailDocument();
      try{
        const holder=document.createElement('div');
        holder.contentEditable='true';
        holder.setAttribute('aria-hidden','true');
        holder.style.position='fixed';
        holder.style.left='-100000px';
        holder.style.top='0';
        holder.style.width='650px';
        holder.innerHTML=html;
        document.body.appendChild(holder);

        const range=document.createRange();
        range.selectNodeContents(holder);
        const selection=window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        const copied=document.execCommand('copy');
        selection.removeAllRanges();
        holder.remove();
        return !!copied;
      }catch{
        return false;
      }
    };

    const openComposeDirectly=()=>{
      const mailSubject=subject();
      const mailBody=makeText();

      // Keep the designed HTML mail ready on the clipboard when the browser allows it.
      copyRichMailSync();

      const params='to='+encodeURIComponent(gmailRecipient)+
        '&subject='+encodeURIComponent(mailSubject)+
        '&body='+encodeURIComponent(mailBody);

      const gmailAppUrl='googlegmail:///co?'+params;
      const mailtoUrl='mailto:'+encodeURIComponent(gmailRecipient)+
        '?subject='+encodeURIComponent(mailSubject)+
        '&body='+encodeURIComponent(mailBody);

      const ua=navigator.userAgent||'';
      const isiOS=/iPhone|iPad|iPod/i.test(ua);

      if(submit){
        submit.disabled=true;
        submit.textContent='開啟寄件…';
      }
      if(status) status.textContent='正在開啟新郵件寄件畫面…';

      if(isiOS){
        let fallbackTimer=null;
        let leftPage=false;

        const cancelFallback=()=>{
          leftPage=true;
          if(fallbackTimer) clearTimeout(fallbackTimer);
          document.removeEventListener('visibilitychange',onVisibilityChange);
          window.removeEventListener('pagehide',cancelFallback);
        };
        const onVisibilityChange=()=>{
          if(document.hidden) cancelFallback();
        };

        document.addEventListener('visibilitychange',onVisibilityChange);
        window.addEventListener('pagehide',cancelFallback,{once:true});

        // Attempt Gmail's iOS compose scheme inside the original user gesture.
        window.location.href=gmailAppUrl;

        // If Gmail is not installed or the scheme is blocked, open the system
        // compose sheet instead. If Gmail is the default mail app, mailto opens Gmail.
        fallbackTimer=setTimeout(()=>{
          if(leftPage) return;
          window.location.href=mailtoUrl;
          setTimeout(()=>{
            if(submit){
              submit.disabled=false;
              submit.textContent='傳送';
            }
          },1200);
        },850);
        return;
      }

      // Other mobile/desktop browsers: mailto opens the configured mail client.
      window.location.href=mailtoUrl;
      setTimeout(()=>{
        if(submit){
          submit.disabled=false;
          submit.textContent='傳送';
        }
      },1200);
    };

    form.addEventListener('submit',e=>{
      e.preventDefault();
      if(current!==steps.length-1){showStep(steps.length-1);return;}
      openComposeDirectly();
    });
    showStep(0);
  }
});