'use strict';
/* Tema: primjenjuje se prije prvog iscrtavanja (učitava se bez defer). mp.theme = 'dark' | 'light' | prazno (prati uređaj). */
(() => {
  try {
    const v = localStorage.getItem('mp.theme');
    if (v === 'dark' || v === 'light') document.documentElement.setAttribute('data-theme', v);
  } catch { /* ignore */ }
})();
