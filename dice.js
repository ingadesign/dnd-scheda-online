/* =========================================================
   DADI — tiri con vantaggio / svantaggio e registro dei tiri
   ---------------------------------------------------------
   window.Dice.d20(bonus, etichetta)   → prova/attacco/TS
   window.Dice.expr("1d8+3", etichetta, {crit}) → danni, cure…
   Il pulsante VAN / SVA in basso a destra vale per il prossimo
   tiro d20, poi torna Normale. L'Esaustione (se presente nelle
   condizioni) toglie 2 per livello ai tiri d20, come nel 2024.
   Non salva nulla nel personaggio: il registro resta in memoria.
   ========================================================= */
(function(){
  const esc = s => escapeHtml(String(s ?? ''));
  let mode = 'normal';          // normal | adv | dis
  const LOG = [];               // ultimi tiri (in memoria)
  let cardTimer = null;

  const rnd = n => 1 + Math.floor(Math.random() * n);
  const sign = n => (n >= 0 ? '+' : '−') + Math.abs(n);

  /* "1d8+3 taglienti" → [{n:1,d:8,s:1},{k:3}] ; null se non c'è nulla da tirare */
  function parse(text){
    if(text === undefined || text === null) return null;
    let s = String(text).replace(/[−–]/g, '-').replace(/×/g, 'x');
    // di solito il tiro è all'inizio ("1d8+3 taglienti"); altrimenti il primo dado nel testo ("Morso: 2d4+2")
    const lead = s.match(/^\s*[+-]?\s*(\d*\s*d\s*\d+|\d+)(\s*[+-]\s*(\d*\s*d\s*\d+|\d+))*/i)
              || s.match(/\d*d\d+(\s*[+-]\s*(\d*d\d+|\d+))*/i);
    if(!lead) return null;
    const parts = [];
    const re = /([+-]?)\s*(?:(\d*)\s*d\s*(\d+)|(\d+))/gi;
    let m;
    while((m = re.exec(lead[0]))){
      const sg = m[1] === '-' ? -1 : 1;
      if(m[3]) parts.push({n: Number(m[2] || 1), d: Number(m[3]), s: sg});
      else parts.push({k: sg * Number(m[4])});
    }
    return parts.length ? parts : null;
  }
  function hasDice(text){ const p = parse(text); return !!(p && p.some(x => x.d)); }

  function exhaustion(){
    const c = (CHAR.conditions || []).find(x => /esaust|exhaust/i.test(x.name));
    return c ? Math.max(1, Number(c.level) || 1) : 0;
  }

  function push(entry){
    LOG.unshift(entry); if(LOG.length > 15) LOG.pop();
    showCard(entry); renderLog();
  }

  /* ---------------- tiro d20 ---------------- */
  function d20(bonus, label, opts = {}){
    const b = Number(String(bonus ?? 0).replace(/[−–]/g, '-').replace(/\s/g, '')) || 0;
    const m = opts.mode || mode;
    const a = rnd(20), c = rnd(20);
    let used = a, other = null;
    if(m === 'adv'){ used = Math.max(a, c); other = Math.min(a, c); }
    if(m === 'dis'){ used = Math.min(a, c); other = Math.max(a, c); }
    const ex = exhaustion();
    const total = used + b - 2 * ex;
    const entry = {
      kind: 'd20', label, total, nat: used, other, bonus: b, mode: m, exhaustion: ex,
      crit: used === 20, fumble: used === 1, dc: opts.dc, time: Date.now()
    };
    if(!opts.keepMode) setMode('normal');
    push(entry);
    return entry;
  }

  /* ---------------- tiro libero (danni, cure, dadi vita) ---------------- */
  function expr(text, label, opts = {}){
    const parts = parse(text);
    if(!parts){ toast('Nessun dado da tirare in «' + text + '»'); return null; }
    const rolls = []; let total = 0;
    parts.forEach(p => {
      if(p.d){
        const n = p.n * (opts.crit ? 2 : 1);
        const r = Array.from({length: n}, () => rnd(p.d));
        rolls.push({d: p.d, r, s: p.s});
        total += p.s * r.reduce((x, y) => x + y, 0);
      } else total += p.k;
    });
    const formula = parts.map((p, i) => (p.d ? (p.s < 0 ? '−' : (i ? '+' : '')) + (p.n * (opts.crit ? 2 : 1)) + 'd' + p.d
                                               : (p.k < 0 ? '−' : (i ? '+' : '')) + Math.abs(p.k))).join('');
    const entry = {kind: 'expr', label, total: Math.max(opts.min ?? -Infinity, total), formula, rolls, crit: !!opts.crit, time: Date.now()};
    push(entry);
    return entry;
  }

  /* ---------------- interfaccia ---------------- */
  const dock = document.createElement('div');
  dock.className = 'dice-dock';
  dock.innerHTML = `
    <div class="roll-card" id="rollCard" role="status" aria-live="polite" hidden></div>
    <div class="dice-tray" id="diceTray" hidden>
      <div class="dice-tray-head"><b>Dadi</b><button class="icon-btn" data-dice="close" aria-label="Chiudi">✕</button></div>
      <div class="dice-quick">${[4,6,8,10,12,20,100].map(n => `<button class="btn small" data-dice="d${n}">d${n}</button>`).join('')}</div>
      <form class="dice-free" id="diceFree">
        <input type="text" id="diceExpr" placeholder="es. 2d6+3" aria-label="Espressione dei dadi" autocomplete="off">
        <button class="btn small primary" type="submit">Tira</button>
      </form>
      <div class="dice-log" id="diceLog"></div>
    </div>
    <div class="dice-bar">
      <button class="dice-mode" data-mode="adv" aria-pressed="false" title="Vantaggio sul prossimo tiro d20">▲ VAN</button>
      <button class="dice-mode" data-mode="dis" aria-pressed="false" title="Svantaggio sul prossimo tiro d20">▼ SVA</button>
      <button class="dice-open" id="diceOpen" aria-expanded="false" title="Dadi e registro dei tiri">🎲</button>
    </div>`;
  document.body.appendChild(dock);
  const card = dock.querySelector('#rollCard'), tray = dock.querySelector('#diceTray');

  function setMode(m){
    mode = m;
    dock.querySelectorAll('.dice-mode').forEach(b => {
      const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
  }

  function entryHtml(e, big){
    if(e.kind === 'd20'){
      const tag = e.crit ? '<span class="roll-tag crit">20 naturale!</span>' : e.fumble ? '<span class="roll-tag fumble">1 naturale</span>' : '';
      const mtag = e.mode === 'adv' ? ' · vantaggio' : e.mode === 'dis' ? ' · svantaggio' : '';
      const dice = e.other !== null ? `<b>${e.nat}</b> <s>${e.other}</s>` : `<b>${e.nat}</b>`;
      const ex = e.exhaustion ? ` − ${2 * e.exhaustion} esaustione` : '';
      const dc = e.dc ? ` · CD ${e.dc}: <b class="${e.total >= e.dc ? 'ok' : 'ko'}">${e.total >= e.dc ? 'superato' : 'fallito'}</b>` : '';
      return `<div class="roll-label">${esc(e.label)}${mtag}</div>
        <div class="roll-total${big ? ' big' : ''}">${e.total}</div>
        <div class="roll-detail">d20 ${dice} ${sign(e.bonus)}${ex}${dc} ${tag}</div>`;
    }
    const det = e.rolls.map(r => `${r.s < 0 ? '−' : ''}d${r.d}: ${r.r.join(', ')}`).join(' · ');
    return `<div class="roll-label">${esc(e.label)}${e.crit ? ' · critico (dadi raddoppiati)' : ''}</div>
      <div class="roll-total${big ? ' big' : ''}">${e.total}</div>
      <div class="roll-detail">${esc(e.formula)} → ${esc(det) || '—'}</div>`;
  }
  function showCard(e){
    card.innerHTML = entryHtml(e, true);
    card.className = 'roll-card' + (e.crit ? ' crit' : e.fumble ? ' fumble' : '');
    card.hidden = false;
    clearTimeout(cardTimer); cardTimer = setTimeout(() => { card.hidden = true; }, 4500);
  }
  function renderLog(){
    const box = dock.querySelector('#diceLog');
    box.innerHTML = LOG.length ? LOG.map(e => `<div class="dice-log-row">${entryHtml(e, false)}</div>`).join('')
                               : '<div class="small-note">Nessun tiro ancora. Tocca un valore nella modalità Sessione o un dado qui sopra.</div>';
  }
  renderLog();

  dock.addEventListener('click', e => {
    const m = e.target.closest('.dice-mode');
    if(m){ setMode(mode === m.dataset.mode ? 'normal' : m.dataset.mode); return; }
    if(e.target.closest('#diceOpen')){
      tray.hidden = !tray.hidden; dock.querySelector('#diceOpen').setAttribute('aria-expanded', !tray.hidden); return;
    }
    if(e.target.closest('.roll-card')){ card.hidden = true; return; }
    const d = e.target.closest('[data-dice]'); if(!d) return;
    if(d.dataset.dice === 'close'){ tray.hidden = true; dock.querySelector('#diceOpen').setAttribute('aria-expanded', 'false'); return; }
    if(d.dataset.dice === 'd20') d20(0, 'd20');
    else expr('1' + d.dataset.dice, d.dataset.dice);
  });
  dock.querySelector('#diceFree').addEventListener('submit', e => {
    e.preventDefault();
    const v = dock.querySelector('#diceExpr').value.trim(); if(!v) return;
    if(/^d?20$/i.test(v) || /^1d20\s*[+-]/i.test(v)){
      const b = (v.match(/[+-]\s*\d+/g) || []).reduce((s, x) => s + Number(x.replace(/\s/g, '')), 0);
      d20(b, v);
    } else expr(v, v);
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape'){ tray.hidden = true; card.hidden = true; } });

  window.Dice = {d20, expr, parse, hasDice, setMode, get mode(){ return mode; }};
})();
