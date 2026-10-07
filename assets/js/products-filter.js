/* SIGNWELL — products category filter, explicit mobile-safe binding. */
(function () {
  'use strict';

  const root = document.querySelector('[data-seg="part-filter"]');
  const list = document.querySelector('[data-part-list]');
  if (!root || !list) return;

  const buttons = Array.from(root.querySelectorAll('[data-seg-item]'));
  const rows = Array.from(list.querySelectorAll('[data-part-row]'));
  const search = document.querySelector('[data-part-search]');
  const count = document.querySelector('[data-part-count]');
  const empty = document.querySelector('[data-part-empty]');
  let category = (buttons.find(button => button.getAttribute('aria-selected') === 'true') || buttons[0])?.dataset.value || 'all';

  function normalize(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  }

  function apply(options) {
    const query = normalize(search && search.value);
    let shown = 0;
    let firstVisible = null;

    rows.forEach(row => {
      const categoryMatch = category === 'all' || row.dataset.group === category;
      const searchMatch = !query || normalize(row.textContent).includes(query);
      const visible = categoryMatch && searchMatch;

      row.hidden = !visible;
      row.setAttribute('aria-hidden', String(!visible));

      if (visible) {
        shown++;
        if (!firstVisible) firstVisible = row;
        if (options && options.animate && row.animate) {
          row.animate(
            [
              { opacity: 0, transform: 'translate3d(0,10px,0)' },
              { opacity: 1, transform: 'translate3d(0,0,0)' }
            ],
            { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }
          );
        }
      }
    });

    if (count) {
      count.textContent = (query || category !== 'all')
        ? '顯示 ' + shown + ' / ' + rows.length + ' 項料號'
        : '共 ' + rows.length + ' 項料號';
    }
    if (empty) empty.hidden = shown > 0;

    // Keep the 3D/spec preview in sync with the selected category.
    if (firstVisible && options && options.selectPreview) {
      const current = list.querySelector('[data-part-row].is-current:not([hidden])');
      if (!current) {
        const previewButton = firstVisible.querySelector('[data-lib-item]');
        if (previewButton) previewButton.click();
      }
    }
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      category = button.dataset.value || 'all';

      buttons.forEach(item => {
        const selected = item === button;
        item.setAttribute('aria-selected', String(selected));
        item.classList.toggle('is-active', selected);
        item.setAttribute('tabindex', selected ? '0' : '-1');
      });

      apply({ animate: true, selectPreview: true });
    });
  });

  if (search) {
    search.addEventListener('input', () => apply({ animate: false, selectPreview: false }));
  }

  apply({ animate: false, selectPreview: false });
})();