(function () {
  const THEMES = {
    greenGold: 'theme-green-gold',
    ausFlag: 'theme-aus-flag',
  };

  const LABELS = {
    [THEMES.greenGold]: 'Switch to Blue/Red/White',
    [THEMES.ausFlag]: 'Switch to Green/Gold',
  };

  const body = document.body;
  const toggleBtn = document.getElementById('themeToggle');

  if (!body || !toggleBtn) {
    return;
  }

  const allThemes = Object.values(THEMES);

  const setTheme = (themeClass) => {
    allThemes.forEach((theme) => body.classList.remove(theme));
    body.classList.add(themeClass);
    try {
      localStorage.setItem('theme', themeClass);
    } catch (error) {
      /* localStorage unavailable */
    }
    toggleBtn.textContent = LABELS[themeClass] || 'Switch Theme';
  };

  let storedTheme;
  try {
    storedTheme = localStorage.getItem('theme');
  } catch (error) {
    storedTheme = null;
  }

  const initialTheme = allThemes.includes(storedTheme)
    ? storedTheme
    : THEMES.greenGold;

  setTheme(initialTheme);

  toggleBtn.addEventListener('click', () => {
    const nextTheme = body.classList.contains(THEMES.greenGold)
      ? THEMES.ausFlag
      : THEMES.greenGold;
    setTheme(nextTheme);
  });
})();
