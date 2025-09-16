(function(){
  const VIEW_KEY = 'y9_view'; // localStorage key

  // Helper: query
  const $ = (s, r=document) => r.querySelector(s);

  // Read initial view from ?view= or localStorage, default to 8week
  function getInitialView() {
    try {
      const url = new URL(location.href);
      const q = (url.searchParams.get('view') || '').toLowerCase();
      if (q === '8week' || q === 'dispositions') return q;
    } catch {}
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === '8week' || saved === 'dispositions') return saved;
    } catch {}
    return '8week';
  }

  // Show/hide sections with accessibility attributes
  function setSectionVisible(el, on) {
    if (!el) return;
    el.hidden = !on;
    el.setAttribute('aria-hidden', String(!on));
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('Fetch failed: ' + path);
    return res.json();
  }

  // Optionally (re)render each view if hooks exist
  async function renderIfAvailable(view) {
    if (view === '8week') {
      if (typeof window.render8Week === 'function') {
        if (!window.DATA_8WEEK && window.DATA_8WEEK_PATH) {
          try { window.DATA_8WEEK = await fetchJSON(window.DATA_8WEEK_PATH); } catch {}
        }
        try { window.render8Week(window.DATA_8WEEK); } catch {}
      }
    } else {
      if (typeof window.renderDispositions === 'function') {
        if (!window.DATA_DISP && window.DATA_DISP_PATH) {
          try { window.DATA_DISP = await fetchJSON(window.DATA_DISP_PATH); } catch {}
        }
        try { window.renderDispositions(window.DATA_DISP); } catch {}
      }
    }
  }

  async function applyView(v) {
    const week = $('#weekView');
    const disp  = $('#dispView');
    const btn  = $('#toggleViewBtn');

    setSectionVisible(week, v === '8week');
    setSectionVisible(disp,  v === 'dispositions');

    if (btn) {
      btn.textContent = (v === '8week') ? 'Switch to Dispositions' : 'Switch to 8-Week Plan';
      btn.setAttribute('aria-pressed', String(v === 'dispositions'));
    }

    // optional: (re)render for the active view
    await renderIfAvailable(v);
  }

  function setUrlParam(view) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('view', view);
      history.replaceState(null, '', url);
    } catch {}
  }

  async function init() {
    const btn = $('#toggleViewBtn');
    if (!$('#weekView') || !$('#dispView') || !btn) return; // graceful no-op if structure missing

    let view = getInitialView();
    await applyView(view);

    btn.addEventListener('click', async () => {
      view = (view === '8week') ? 'dispositions' : '8week';
      try { localStorage.setItem(VIEW_KEY, view); } catch {}
      setUrlParam(view);
      await applyView(view);
    });
  }

  // Expose optional paths if you plan to lazy-load JSON
  // Example (set these in your page script elsewhere):
  // window.DATA_8WEEK_PATH = 'data/8week.json';
  // window.DATA_DISP_PATH  = 'data/dispositions.json';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
