/* SIGNWELL — adaptive guide for public visitors. */
(function () {
  'use strict';

  const guide = document.querySelector('[data-people-guide]');
  if (!guide) return;

  const stateButtons = Array.from(guide.querySelectorAll('[data-guide-state]'));
  const needButtons = Array.from(guide.querySelectorAll('[data-guide-need]'));
  const needStep = guide.querySelector('[data-guide-need-step]');
  const result = guide.querySelector('[data-guide-result]');
  const title = guide.querySelector('[data-guide-title]');
  const description = guide.querySelector('[data-guide-description]');
  const list = guide.querySelector('[data-guide-list]');
  const primary = guide.querySelector('[data-guide-primary]');
  const secondary = guide.querySelector('[data-guide-secondary]');

  const states = {
    photo: {
      label: '只有照片或外觀',
      intro: '先不要猜料號，第一步是把可辨識資訊補齊。',
      steps: [
        '拍清楚零件正面、背面、腳位，以及它在電路板上的位置',
        '記下設備品牌、型號與零件大約尺寸；若有字樣，完整抄下'
      ]
    },
    mark: {
      label: '看得到字樣或部分料號',
      intro: '你已經有很重要的線索，但字樣不一定等於完整料號。',
      steps: [
        '逐字抄下所有字母、數字、符號與前後綴，不要自行省略',
        '先確認製造商與封裝，再對照原廠 Datasheet，避免只看外觀判斷'
      ]
    },
    function: {
      label: '知道用途，但不懂規格',
      intro: '從使用條件反推規格，比直接找「長得像的」安全。',
      steps: [
        '記錄電壓、電流、阻值、尺寸、腳位或連接方式等已知條件',
        '分開列出「一定不能變」與「可以接受替代」的條件'
      ]
    },
    exact: {
      label: '已有完整料號',
      intro: '資料已接近可以正式尋料或詢價的程度。',
      steps: [
        '再核對一次製造商、完整前後綴與版本，避免相近型號混用',
        '準備需求數量、包裝方式、期望時程，以及是否接受替代料'
      ]
    }
  };

  const needs = {
    same: {
      title: '先確認身分，再找同一顆。',
      desc: '你的目標是找到相同料件。先把辨識資訊做完整，再進入尋料，會比直接用外觀搜尋更可靠。',
      steps: ['用「尋料情境指引」確認還缺哪些資料', '找到候選料件後，再回到原廠規格逐項核對'],
      href: 'sourcing.html#advisor',
      label: '開啟尋料指引',
      secondaryHref: 'products.html#part-records',
      secondaryLabel: '查看料號紀錄'
    },
    substitute: {
      title: '替代料不是「看起來一樣」。',
      desc: '你的目標是找可替代方案。先把不可變動的電氣、尺寸與使用條件列出，再談替代範圍。',
      steps: ['整理不可變動規格與可接受差異', '替代候選仍需依 Datasheet 與實際應用條件確認'],
      href: 'sourcing.html#advisor',
      label: '建立替代條件',
      secondaryHref: 'products.html',
      secondaryLabel: '看零件與工具'
    },
    learn: {
      title: '先學會看關鍵資訊，不必一次懂全部。',
      desc: '你的目標是看懂手上的零件。從代碼、封裝、Datasheet 三件事開始，就能避開大部分常見誤判。',
      steps: ['先從可直接辨識的代碼與標示開始', '再理解封裝、額定值與 Datasheet 欄位各代表什麼'],
      href: 'products.html#resistor-tools',
      label: '從電阻工具開始',
      secondaryHref: 'sourcing.html#advisor',
      secondaryLabel: '我還是想問怎麼找'
    },
    quote: {
      title: '把現有資訊整理成一份可回覆的需求。',
      desc: '你的目標是準備詢價。即使資訊還不完整，也可以先把已知與未知分開，讓後續確認更有效率。',
      steps: ['填入完整料號或目前掌握的規格與照片線索', '補上數量、時程與可否接受替代，未知欄位可明確標示待確認'],
      href: 'rfq.html',
      label: '開始整理詢價',
      secondaryHref: 'sourcing.html#advisor',
      secondaryLabel: '先檢查我缺什麼'
    }
  };

  let state = '';
  let need = '';

  function select(buttons, active, attribute) {
    buttons.forEach(button => {
      const selected = button.getAttribute(attribute) === active;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
    });
  }

  function render() {
    if (state) {
      needStep.hidden = false;
      guide.classList.add('has-state');
    }

    if (!state || !need) {
      result.hidden = true;
      guide.classList.remove('is-complete');
      return;
    }

    const s = states[state];
    const n = needs[need];
    title.textContent = n.title;
    description.textContent = s.intro + ' ' + n.desc;
    list.innerHTML = s.steps.concat(n.steps).map((item, index) =>
      '<li><span class="mono">' + String(index + 1).padStart(2, '0') + '</span><span>' + item + '</span></li>'
    ).join('');

    primary.href = n.href;
    primary.querySelector('span').textContent = n.label;
    secondary.href = n.secondaryHref;
    secondary.textContent = n.secondaryLabel;

    result.hidden = false;
    guide.classList.add('is-complete');
  }

  stateButtons.forEach(button => {
    button.addEventListener('click', () => {
      state = button.dataset.guideState;
      select(stateButtons, state, 'data-guide-state');
      render();
    });
  });

  needButtons.forEach(button => {
    button.addEventListener('click', () => {
      need = button.dataset.guideNeed;
      select(needButtons, need, 'data-guide-need');
      render();
    });
  });
})();