/* render-toggle.js
   - Adds an accessible toggle (8-Week ⇄ Dispositions)
   - Renders both views from JSON
   - Search + Select-to-Print + Favourites
   - Vanilla JS, no dependencies
*/
(function(){
  const VIEW_KEY = 'y9_view';
  const FAV_KEY  = 'y9_favs';
  const SEL_KEY  = 'y9_selected';
  const ZONE     = 'Australia/Melbourne';

  // ---------- tiny helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const ls = {
    get(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
  };

  // ---------- view toggle ----------
  function styleMatchLoadButton() {
    const toggle = $('#toggleViewBtn');
    if (!toggle) return;
    const loadBtn = Array.from(document.querySelectorAll('button, .btn, .button'))
      .find(b => /\bload\b/i.test(b.textContent || ''));
    if (loadBtn) {
      toggle.className = '';
      loadBtn.classList.forEach(c => toggle.classList.add(c));
    }
  }

  function getInitialView() {
    // 1) ?view=
    try {
      const q = new URL(location.href).searchParams.get('view');
      if (q === '8week' || q === 'dispositions') return q;
    } catch {}
    // 2) saved
    const saved = ls.get(VIEW_KEY, null);
    if (saved === '8week' || saved === 'dispositions') return saved;
    // 3) default
    return '8week';
  }

  function setUrlParam(view) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('view', view);
      history.replaceState(null, '', url);
    } catch {}
  }

  function setVisible(el, on) {
    if (!el) return;
    el.hidden = !on;
    el.setAttribute('aria-hidden', String(!on));
  }

  async function applyView(view){
    setVisible($('#weekView'), view === '8week');
    setVisible($('#dispView'), view === 'dispositions');
    const btn = $('#toggleViewBtn');
    if (btn) {
      btn.textContent = (view === '8week') ? 'Switch to Dispositions' : 'Switch to 8-Week Plan';
      btn.setAttribute('aria-pressed', String(view === 'dispositions'));
    }
    // (re)render active view if not yet rendered
    if (view === '8week' && !$('#weekGrid').dataset.rendered) {
      await ensure8Week();
    } else if (view === 'dispositions' && !$('#dispGrid').dataset.rendered) {
      await ensureDispositions();
    }
  }

  // ---------- data loading ----------
  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch ' + path);
    return res.json();
  }

  async function ensure8Week(){
    if (!window.DATA_8WEEK) {
      if (window.DATA_8WEEK_PATH) window.DATA_8WEEK = await fetchJSON(window.DATA_8WEEK_PATH);
      else { console.warn('DATA_8WEEK not set; provide window.DATA_8WEEK or DATA_8WEEK_PATH'); return; }
    }
    render8Week(window.DATA_8WEEK);
  }

  async function ensureDispositions(){
    if (!window.DATA_DISP) {
      if (window.DATA_DISP_PATH) window.DATA_DISP = await fetchJSON(window.DATA_DISP_PATH);
      else { console.warn('DATA_DISP not set; provide window.DATA_DISP or DATA_DISP_PATH'); return; }
    }
    renderDispositions(window.DATA_DISP);
  }

  // ---------- common UI bits ----------
  function star(isOn){ return `<button class="fav" aria-pressed="${isOn}">★</button>` }
  function chip(t){ return `<span class="chip">${t}</span>` }
  function safeTxt(x){ return String(x ?? '').replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s])) }

  function hookSearch(inputEl, onChange){
    if (!inputEl) return;
    let t; inputEl.addEventListener('input', e=>{
      clearTimeout(t); t=setTimeout(()=> onChange(e.target.value.trim().toLowerCase()), 150);
    });
  }

  function openPrintDoc(title, blocks){
    const win = window.open('', 'printwin');
    const css = `
      body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:20px}
      .meta{color:#555}
      .card{border:1px solid #ddd;border-radius:10px;padding:12px;margin:12px 0}
      h1{margin:0 0 8px}
      h2{margin:10px 0 4px}
      ul,ol{margin:6px 0 6px 22px}
    `;
    win.document.write(`<html><head><title>${safeTxt(title)}</title><style>${css}</style></head><body>`);
    win.document.write(`<h1>${safeTxt(title)}</h1><div class="meta">Printed ${new Date().toLocaleString('en-AU',{ timeZone: ZONE })}</div>`);
    blocks.forEach(html => win.document.write(`<div class="card">${html}</div>`));
    win.document.write(`</body></html>`);
    win.document.close(); win.focus(); win.print();
  }

  // ---------- favourites / selections (shared) ----------
  const favs = new Set(ls.get(FAV_KEY, []));
  const selected = new Set(ls.get(SEL_KEY, []));

  function toggleFav(id){
    favs.has(id) ? favs.delete(id) : favs.add(id);
    ls.set(FAV_KEY, [...favs]);
  }
  function toggleSel(id){
    selected.has(id) ? selected.delete(id) : selected.add(id);
    ls.set(SEL_KEY, [...selected]);
  }

  // ---------- 8-Week renderer ----------
  function render8Week(json){
    const grid = $('#weekGrid'); if (!grid) return;
    grid.innerHTML = '';
    grid.dataset.rendered = '1';

    const qEl = $('#weekSearch');
    let q = '';
    const matches = (s) => !q || s.toLowerCase().includes(q);

    json.weeks.forEach(week=>{
      // Week heading
      const h = document.createElement('h2');
      h.textContent = `Week ${week.week}: ${week.title}`;
      grid.appendChild(h);

      (week.lessons || []).forEach(lsn=>{
        const id = `8w-${lsn.id}`;
        const favOn = favs.has(id);
        const selOn = selected.has(id);

        const textIndex = [
          lsn.title, ...(lsn.objectives||[]), ...(lsn.steps||[]), ...(lsn.successCriteria||[]), ...(lsn.tags||[])
        ].join(' ').toLowerCase();
        if (!matches(textIndex)) return;

        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <header class="card-h">
            <div>
              <h3>${safeTxt(lsn.title)}</h3>
              <div class="meta">
                ${chip(`⏱ ${lsn.duration || '—'}`)}
                ${(lsn.tags||[]).map(chip).join('')}
              </div>
            </div>
            <div class="actions">
              <label><input type="checkbox" ${selOn ? 'checked' : ''} aria-label="Select for print"> Select</label>
              ${star(favOn)}
            </div>
          </header>
          <div class="body">
            ${lsn.objectives?.length ? `<p><strong>Objectives</strong><ul>${lsn.objectives.map(x=>`<li>${safeTxt(x)}`).join('')}</ul></p>` : ''}
            ${lsn.steps?.length ? `<p><strong>Steps</strong><ol>${lsn.steps.map(x=>`<li>${safeTxt(x)}`).join('')}</ol></p>` : ''}
            ${lsn.successCriteria?.length ? `<p><strong>Success criteria (I can…)</strong><ul>${lsn.successCriteria.map(x=>`<li>${safeTxt(x)}`).join('')}</ul></p>` : ''}
          </div>
        `;
        const [sel, favBtn] = [ card.querySelector('input[type=checkbox]'), card.querySelector('.fav') ];
        sel.addEventListener('change', ()=> toggleSel(id));
        favBtn.addEventListener('click', (e)=>{ toggleFav(id); favBtn.setAttribute('aria-pressed', String(!favOn)); });

        grid.appendChild(card);
      });
    });

    // Search hook
    hookSearch(qEl, val => { q = val; render8Week(json); });

    // Print
    const printBtn = $('#printWeek');
    if (printBtn) {
      printBtn.onclick = ()=>{
        const blocks = [];
        json.weeks.forEach(week=>{
          (week.lessons||[]).forEach(lsn=>{
            const id = `8w-${lsn.id}`;
            if (!selected.has(id)) return;
            const standards = (lsn.standardsRefs||[]).join(', ');
            blocks.push(
              `<h2>${safeTxt(lsn.title)}</h2>
               <div><strong>Week:</strong> ${week.week} – ${safeTxt(week.title)}</div>
               <div><strong>Duration:</strong> ${safeTxt(lsn.duration||'—')}</div>
               ${standards?`<div><strong>Standards:</strong> ${safeTxt(standards)}</div>`:''}
               ${lsn.objectives?.length?`<div><strong>Objectives</strong><ul>${lsn.objectives.map(s=>`<li>${safeTxt(s)}`).join('')}</ul></div>`:''}
               ${lsn.steps?.length?`<div><strong>Steps</strong><ol>${lsn.steps.map(s=>`<li>${safeTxt(s)}`).join('')}</ol></div>`:''}
               ${lsn.successCriteria?.length?`<div><strong>Success criteria</strong><ul>${lsn.successCriteria.map(s=>`<li>${safeTxt(s)}`).join('')}</ul></div>`:''}`
            );
          });
        });
        if (!blocks.length) return alert('Select at least one lesson to print.');
        openPrintDoc('8-Week Plan – Selected Lessons', blocks);
      };
    }
  }

  // ---------- Dispositions renderer ----------
  // Expected shape:
  // { dispositions: [ { id,title,color,definition,iCan:[...], activities:[{id,title,duration,type[],objectives[],steps[],successCriteria[],tags[],standardsRefs[]}] } ] }
  function renderDispositions(json){
    const grid = $('#dispGrid'); if (!grid) return;
    grid.innerHTML = '';
    grid.dataset.rendered = '1';

    const qEl = $('#dispSearch');
    let q = '';
    const matches = (s) => !q || s.toLowerCase().includes(q);

    (json.dispositions||[]).forEach(d=>{
      // Disposition banner
      const banner = document.createElement('div');
      banner.className = 'banner';
      banner.innerHTML = `
        <h2>${safeTxt(d.title)}</h2>
        <p class="muted">${safeTxt(d.definition||'')}</p>
        <div class="ican">${(d.iCan||[]).map(x=>chip(safeTxt(x))).join(' ')}</div>
      `;
      grid.appendChild(banner);

      (d.activities||[]).forEach(act=>{
        const id = `disp-${act.id}`;
        const favOn = favs.has(id);
        const selOn = selected.has(id);
        const textIndex = [
          act.title, ...(act.objectives||[]), ...(act.steps||[]), ...(act.successCriteria||[]), ...(act.tags||[])
        ].join(' ').toLowerCase();
        if (!matches(textIndex)) return;

        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <header class="card-h">
            <div>
              <h3>${safeTxt(act.title)}</h3>
              <div class="meta">
                ${chip(`⏱ ${act.duration || '—'}`)}
                ${(act.type||[]).map(chip).join('')}
                ${d.title ? chip(d.title) : ''}
              </div>
            </div>
            <div class="actions">
              <label><input type="checkbox" ${selOn ? 'checked' : ''} aria-label="Select for print"> Select</label>
              ${star(favOn)}
            </div>
          </header>
          <div class="body">
            ${act.objectives?.length ? `<p><strong>Objectives</strong><ul>${act.objectives.map(x=>`<li>${safeTxt(x)}`).join('')}</ul></p>` : ''}
            ${act.steps?.length ? `<p><strong>Steps</strong><ol>${act.steps.map(x=>`<li>${safeTxt(x)}`).join('')}</ol></p>` : ''}
            ${act.successCriteria?.length ? `<p><strong>Success criteria (I can…)</strong><ul>${act.successCriteria.map(x=>`<li>${safeTxt(x)}`).join('')}</ul></p>` : ''}
          </div>
        `;
        const [sel, favBtn] = [ card.querySelector('input[type=checkbox]'), card.querySelector('.fav') ];
        sel.addEventListener('change', ()=> toggleSel(id));
        favBtn.addEventListener('click', ()=> { toggleFav(id); favBtn.setAttribute('aria-pressed', String(!favOn)); });

        grid.appendChild(card);
      });
    });

    // Search hook
    hookSearch(qEl, val => { q = val; renderDispositions(json); });

    // Print
    const printBtn = $('#printDisp');
    if (printBtn) {
      printBtn.onclick = ()=>{
        const blocks = [];
        (json.dispositions||[]).forEach(d=>{
          (d.activities||[]).forEach(act=>{
            const id = `disp-${act.id}`;
            if (!selected.has(id)) return;
            const standards = (act.standardsRefs||[]).join(', ');
            blocks.push(
              `<h2>${safeTxt(act.title)}</h2>
               <div><strong>Disposition:</strong> ${safeTxt(d.title||'')}</div>
               <div><strong>Duration:</strong> ${safeTxt(act.duration||'—')}</div>
               ${standards?`<div><strong>Standards:</strong> ${safeTxt(standards)}</div>`:''}
               ${act.objectives?.length?`<div><strong>Objectives</strong><ul>${act.objectives.map(s=>`<li>${safeTxt(s)}`).join('')}</ul></div>`:''}
               ${act.steps?.length?`<div><strong>Steps</strong><ol>${act.steps.map(s=>`<li>${safeTxt(s)}`).join('')}</ol></div>`:''}
               ${act.successCriteria?.length?`<div><strong>Success criteria</strong><ul>${act.successCriteria.map(s=>`<li>${safeTxt(s)}`).join('')}</ul></div>`:''}`
            );
          });
        });
        if (!blocks.length) return alert('Select at least one activity to print.');
        openPrintDoc('Dispositions – Selected Activities', blocks);
      };
    }
  }

  // ---------- init ----------
  async function init(){
    styleMatchLoadButton();

    // Toggle behaviour
    const btn = $('#toggleViewBtn');
    if (btn) {
      let view = getInitialView();
      await applyView(view);
      btn.addEventListener('click', async ()=>{
        view = (view === '8week') ? 'dispositions' : '8week';
        ls.set(VIEW_KEY, view);
        setUrlParam(view);
        await applyView(view);
      });
    }

    // If no toggle button (unlikely), still render default view
    if (!btn) {
      const view = getInitialView();
      await applyView(view);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
