/* SIGNWELL rich quotation mail. Gmail compose URLs cannot carry HTML; the
   clipboard and exported messages use the same inline HTML as the preview. */
(function () {
  'use strict';

  function copyLegacy(preview, html, text) {
    const selection = window.getSelection();
    const previous = [];
    if (selection) {
      for (let i = 0; i < selection.rangeCount; i++) previous.push(selection.getRangeAt(i).cloneRange());
    }
    const holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:fixed;left:-100000px;top:0;width:640px;';
    holder.innerHTML = html;
    const onCopy = function (event) {
      if (!event.clipboardData) return;
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
    };
    document.body.appendChild(holder);
    document.addEventListener('copy', onCopy);
    try {
      const range = document.createRange();
      range.selectNodeContents(holder);
      selection.removeAllRanges();
      selection.addRange(range);
      return !!document.execCommand('copy');
    } catch (_) {
      return false;
    } finally {
      document.removeEventListener('copy', onCopy);
      holder.remove();
      if (selection) {
        selection.removeAllRanges();
        previous.forEach(function (range) { selection.addRange(range); });
      }
    }
  }

  async function copyRich(preview, html, text) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
        return copyLegacy(preview, html, text);
      }
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], {type: 'text/html'}),
        'text/plain': new Blob([text], {type: 'text/plain'})
      })]);
      return true;
    } catch (_) {
      return copyLegacy(preview, html, text);
    }
  }

  function base64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  }

  function mimeBody(value) {
    return base64Utf8(value).match(/.{1,76}/g).join('\r\n');
  }

  function mimeSubject(value) {
    const chunks = [];
    let chunk = '';
    for (const character of String(value).replace(/[\r\n]/g, ' ')) {
      if (new TextEncoder().encode(chunk + character).length > 42) {
        chunks.push('=?UTF-8?B?' + base64Utf8(chunk) + '?=');
        chunk = '';
      }
      chunk += character;
    }
    if (chunk) chunks.push('=?UTF-8?B?' + base64Utf8(chunk) + '?=');
    return chunks.join('\r\n ');
  }

  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], {type: type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  window.SignwellRichMail = {
    bind: function (options) {
      const form = options.form;
      const preview = options.preview;
      const status = options.status;
      const submit = options.submit;
      const recipient = options.recipient;
      const setStatus = function (message) { if (status) status.textContent = message; };
      const render = function () {
        const markup = options.markup();
        if (preview) preview.innerHTML = markup;
        return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIGNWELL 詢價</title></head><body style="margin:0;background:#F3F3F0">' + markup + '</body></html>';
      };
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isMobile = isIOS || /Android|Mobile|IEMobile|Opera Mini/i.test(ua);

      const gmailWebUrl = function () {
        const params = new URLSearchParams({
          view: 'cm',
          fs: '1',
          to: recipient,
          su: options.subject(),
          body: options.text()
        });
        return 'https://mail.google.com/mail/u/0/?' + params.toString();
      };

      const gmailIOSUrl = function () {
        const params = new URLSearchParams({
          to: recipient,
          subject: options.subject(),
          body: options.text()
        });
        return 'googlegmail://co?' + params.toString();
      };

      const setDeviceLabel = function () {
        if (!submit) return;
        const label = submit.querySelector('[data-submit-label]');
        if (!label) return;
        label.textContent = isIOS ? '以 Gmail App 開啟' : '開啟 Gmail 寄件視窗';
      };
      setDeviceLabel();

      const openMailComposer = function () {
        const web = gmailWebUrl();

        if (isIOS) {
          setStatus('正在開啟 Gmail App；若未安裝 Gmail，將自動改用 Gmail 網頁版。網站不會自動寄出。');
          const started = Date.now();
          window.location.href = gmailIOSUrl();

          setTimeout(function () {
            if (document.visibilityState === 'visible' && Date.now() - started < 2400) {
              window.location.href = web;
            }
          }, 900);
          return true;
        }

        if (isMobile) {
          setStatus('正在開啟手機版 Gmail 寄件視窗；網站不會自動寄出。');
          window.location.href = web;
          return true;
        }

        setStatus('正在開啟 Gmail 寄件視窗；收件人、主旨與純文字內容會自動帶入。網站不會自動寄出。');
        const draft = window.open(web, '_blank', 'noopener');
        if (!draft) {
          setStatus('瀏覽器封鎖了新分頁，正在改用目前分頁開啟 Gmail。');
          window.location.href = web;
        }
        return true;
      };
      const copy = async function () {
        const copied = await copyRich(preview, render(), options.text());
        setStatus(copied
          ? '完整排版已複製。到 Gmail 信件內文貼上（Ctrl／⌘＋V，手機長按「貼上」），確認後按「傳送」。'
          : '瀏覽器未允許複製。請按「選取排版」後複製，或下載 HTML 信件，再將完整排版貼入 Gmail。');
        return copied;
      };
      const copyButton = form.querySelector('[data-rfq-copy-html]');
      if (copyButton) copyButton.addEventListener('click', copy);
      const selectButton = form.querySelector('[data-rfq-select-html]');
      if (selectButton) selectButton.addEventListener('click', function () {
        render();
        const range = document.createRange();
        range.selectNodeContents(preview);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        setStatus('已選取完整排版，請使用系統「複製」，到 Gmail 內文貼上後寄出。');
      });
      const htmlButton = form.querySelector('[data-rfq-download-html]');
      if (htmlButton) htmlButton.addEventListener('click', function () {
        download(render(), 'text/html;charset=utf-8', 'SIGNWELL-詢價.html');
        setStatus('已下載與預覽相同的 HTML 信件，保留完整料件與聯絡資料。');
      });
      const emlButton = form.querySelector('[data-rfq-download-eml]');
      if (emlButton) emlButton.addEventListener('click', function () {
        const html = render();
        const boundary = 'signwell-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        const message = [
          'To: ' + recipient,
          'Subject: ' + mimeSubject(options.subject()),
          'Date: ' + new Date().toUTCString(),
          'MIME-Version: 1.0',
          'X-Unsent: 1',
          'Content-Type: multipart/alternative; boundary="' + boundary + '"',
          '',
          '--' + boundary,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          mimeBody(options.text()),
          '--' + boundary,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          mimeBody(html),
          '--' + boundary + '--',
          ''
        ].join('\r\n');
        download(message, 'message/rfc822', 'SIGNWELL-詢價.eml');
        setStatus('已下載含完整 HTML 排版的 .eml 信件，可用支援此格式的郵件 App 開啟；Gmail 請使用複製排版方式。');
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!options.isFinal()) { options.showFinal(); return; }

        if (submit) submit.disabled = true;
        openMailComposer();

        setTimeout(function () {
          if (submit) submit.disabled = false;
        }, isIOS ? 1200 : 500);
      });
    }
  };
})();
