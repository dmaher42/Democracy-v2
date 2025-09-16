(function(){
  const VIEW_KEY = 'y9_view'; // localStorage key

  const $ = (s, r=document) => r.querySelector(s);

  // Try to style-match the existing "Load" button by cloning its classes
  function styleMatchLoadButton() {
    const loadBtn = Array.from(document.querySelectorAll('button, .btn, .button'))
      .find(b => /\bload\b/i.test(b.textContent || ''));
    const toggle = $('#toggleViewBtn');
    if (!toggle) return;
    if (loadBtn) {
      loadBtn.classList.forEach(c => {
        if (c && !toggle.classList.contains(c)) toggle.classList.add(c);
      });
    }
    toggle.classList.add('btn');
    toggle.classList.add('btn-primary');
  }

  function getInitialView() {
    // 1) URL param
    try {
      const q = new URL(location.href).searchParams.get('view');
      if (q === '8week' || q === 'dispositions') return q;
    } catch {}
    // 2) Stored
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === '8week' || saved === 'dispositions') return saved;
    } catch {}
    // 3) Default
    return '8week';
  }

  function setSectionVisible(el, on) {
    if (!el) return;
    el.hidden = !on;
    el.setAttribute('aria-hidden', String(!on));
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch ' + path);
    return res.json();
  }

  // Optional hooks if you have renderers and JSON paths
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

  function setUrlParam(view) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('view', view);
      history.replaceState(null, '', url);
    } catch {}
  }

  async function applyView(view) {
    const week = $('#weekView');
    const disp  = $('#dispView');
    const btn  = $('#toggleViewBtn');

    setSectionVisible(week, view === '8week');
    setSectionVisible(disp,  view === 'dispositions');

    if (btn) {
      btn.textContent = (view === '8week') ? 'Switch to Dispositions' : 'Switch to 8-Week Plan';
      btn.setAttribute('aria-pressed', String(view === 'dispositions'));
    }

    await renderIfAvailable(view);
  }

  async function init() {
    const week = $('#weekView');
    const disp = $('#dispView');
    const btn  = $('#toggleViewBtn');
    if (!week || !disp || !btn) return; // graceful no-op if structure isn’t ready

    styleMatchLoadButton();

    let view = getInitialView();
    await applyView(view);

    btn.addEventListener('click', async () => {
      view = (view === '8week') ? 'dispositions' : '8week';
      try { localStorage.setItem(VIEW_KEY, view); } catch {}
      setUrlParam(view);
      await applyView(view);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
