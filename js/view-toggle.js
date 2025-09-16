(function(){
  const VIEW_KEY = 'y9_view';
  const VALID_VIEWS = ['8week', 'dispositions'];
  const VIEW_SET = new Set(VALID_VIEWS);
  const DEFAULT_VIEW = '8week';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.prototype.slice.call(root.querySelectorAll(selector));

  function normaliseView(value) {
    return (value || '').toLowerCase();
  }

  function asView(value) {
    const view = normaliseView(value);
    return VIEW_SET.has(view) ? view : '';
  }

  function getHashTarget() {
    if (!location.hash) return null;
    const raw = location.hash.slice(1);
    if (!raw) return null;
    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {}
    if (!id) return null;
    return document.getElementById(id);
  }

  function viewFromHash() {
    const target = getHashTarget();
    if (!target) return '';
    const panel = target.closest('[data-view-panel]');
    if (!panel) return '';
    return asView(panel.getAttribute('data-view-panel'));
  }

  function viewFromQuery() {
    try {
      const url = new URL(location.href);
      return asView(url.searchParams.get('view'));
    } catch {
      return '';
    }
  }

  function viewFromStorage() {
    try {
      return asView(localStorage.getItem(VIEW_KEY));
    } catch {
      return '';
    }
  }

  function getInitialView() {
    return viewFromHash() || viewFromQuery() || viewFromStorage() || DEFAULT_VIEW;
  }

  function focusWithoutScroll(el) {
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }

  function setUrlParam(view) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('view', view);
      history.replaceState(null, '', url);
    } catch {}
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch ' + path);
    return res.json();
  }

  async function renderIfAvailable(view) {
    if (view === '8week') {
      if (typeof window.render8Week === 'function') {
        if (!window.DATA_8WEEK && window.DATA_8WEEK_PATH) {
          try {
            window.DATA_8WEEK = await fetchJSON(window.DATA_8WEEK_PATH);
          } catch {}
        }
        try { window.render8Week(window.DATA_8WEEK); } catch {}
      }
    } else if (view === 'dispositions') {
      if (typeof window.renderDispositions === 'function') {
        if (!window.DATA_DISP && window.DATA_DISP_PATH) {
          try {
            window.DATA_DISP = await fetchJSON(window.DATA_DISP_PATH);
          } catch {}
        }
        try { window.renderDispositions(window.DATA_DISP); } catch {}
      }
    }
  }

  function init() {
    const tablist = $('[data-view-tablist]');
    if (!tablist) return;

    const tabButtons = $$('[data-view-tab]', tablist);
    if (!tabButtons.length) return;

    const entries = [];
    const viewMap = new Map();

    tabButtons.forEach((tab) => {
      const view = asView(tab.getAttribute('data-view-tab'));
      if (!view) return;

      const targetId = tab.getAttribute('data-view-target') || tab.getAttribute('aria-controls') || '';
      let panel = targetId ? document.getElementById(targetId) : null;
      if (!panel) {
        panel = document.querySelector(`[data-view-panel="${view}"]`);
      }
      if (!panel) return;

      if (!panel.id) {
        panel.id = `view-panel-${view}`;
      }

      panel.setAttribute('data-view-panel', view);
      panel.setAttribute('role', 'tabpanel');

      const tabId = tab.id || `view-tab-${view}`;
      tab.id = tabId;
      panel.setAttribute('aria-labelledby', tabId);
      tab.setAttribute('aria-controls', panel.id);
      tab.setAttribute('type', tab.getAttribute('type') || 'button');

      entries.push({ view, tab, panel });
      if (!viewMap.has(view)) {
        viewMap.set(view, { view, tab, panel });
      }
    });

    if (!entries.length) return;

    let currentView = '';

    const setTabStates = (activeView) => {
      entries.forEach(({ view, tab, panel }) => {
        const isActive = view === activeView;
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
        tab.classList.toggle('shadow', isActive);
        tab.classList.toggle('font-semibold', isActive);
        if (panel) {
          panel.hidden = !isActive;
          panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
          panel.setAttribute('tabindex', isActive ? '0' : '-1');
        }
      });
    };

    const activateView = async (view, options = {}) => {
      if (!VIEW_SET.has(view)) return;
      const entry = viewMap.get(view);
      if (!entry) return;
      const { tab } = entry;

      if (view === currentView && !options.force) {
        if (options.focusTab) focusWithoutScroll(tab);
        return;
      }

      currentView = view;
      setTabStates(view);

      if (options.store !== false) {
        try { localStorage.setItem(VIEW_KEY, view); } catch {}
      }

      if (options.updateUrl !== false) {
        setUrlParam(view);
      }

      if (options.focusTab) {
        focusWithoutScroll(tab);
      }

      await renderIfAvailable(view);
    };

    let initialView = getInitialView();
    if (!VIEW_SET.has(initialView)) {
      initialView = DEFAULT_VIEW;
    }
    activateView(initialView, { updateUrl: false }).catch(() => {});

    const moveFocus = async (targetEntry) => {
      if (!targetEntry) return;
      const { view, tab } = targetEntry;
      await activateView(view);
      focusWithoutScroll(tab);
    };

    entries.forEach((entry, index) => {
      const { tab } = entry;

      tab.addEventListener('click', async (event) => {
        event.preventDefault();
        await activateView(entry.view);
      });

      tab.addEventListener('keydown', async (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const key = event.key || '';
        const lower = key.toLowerCase();
        let targetEntry = null;

        if (lower === 'arrowleft' || lower === 'left') {
          event.preventDefault();
          const prevIndex = (index - 1 + entries.length) % entries.length;
          targetEntry = entries[prevIndex];
        } else if (lower === 'arrowright' || lower === 'right') {
          event.preventDefault();
          const nextIndex = (index + 1) % entries.length;
          targetEntry = entries[nextIndex];
        } else if (lower === 'home') {
          event.preventDefault();
          targetEntry = entries[0];
        } else if (lower === 'end') {
          event.preventDefault();
          targetEntry = entries[entries.length - 1];
        }

        if (targetEntry) {
          await moveFocus(targetEntry);
        }
      });
    });

    const syncFromHash = () => {
      const hashView = viewFromHash();
      if (hashView && hashView !== currentView) {
        activateView(hashView).catch(() => {});
      }
    };

    window.addEventListener('hashchange', syncFromHash);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
