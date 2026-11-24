/* =========================================================
   EXTRA DELLA SCHEDA
   1. Risorse di classe (Ki, Furia…) con pallini d'uso
   2. Layout personalizzabile: ordine delle sezioni nelle due
      colonne e larghezza delle colonne. Niente larghezze libere
      per sezione: a colonne non si creano buchi.
   Si appoggia a app.js (CHAR, markSaving, uid, …). Il formato
   dei dati del personaggio non cambia: aggiunge solo
   CHAR.resources = [{id, name, max, cur, recharge}].
   ========================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const num = v => Number(v) || 0;
  const esc = s => escapeHtml(String(s ?? ''));

  /* =================== 1. RISORSE DI CLASSE =================== */
  function ensureResources(){
    if(!Array.isArray(CHAR.resources)) CHAR.resources = [];
    CHAR.resources.forEach(r=>{
      if(!r.id) r.id = uid();
      if(r.max === undefined) r.max = 1;
      if(r.cur === undefined) r.cur = r.max;
      if(r.recharge === undefined) r.recharge = 'long';
    });
  }
  ensureResources();

  function usageHtml(r){
    const mx = num(r.max), cu = Math.min(num(r.cur), mx);
    if(mx <= 12){   // pallini pieni = usi rimasti
      return `<div class="res-pips">${Array.from({length:mx},(_,k)=>
        `<button class="res-pip${k>=cu?' used':''}" data-k="${k+1}" aria-label="${esc(r.name)||'Risorsa'}: ${k+1} di ${mx}"></button>`).join('')}</div>`;
    }
    return `<div class="res-counter"><button data-step="-1" aria-label="Usa">−</button><b>${cu}</b><button data-step="1" aria-label="Recupera">+</button></div>`;
  }
  function renderResourcesEditor(){
    const wrap = $('resourcesEditor'); if(!wrap) return;
    if(!CHAR.resources.length){ wrap.innerHTML = '<div class="empty-hint">Nessuna risorsa. Aggiungine una.</div>'; return; }
    wrap.innerHTML = `<div class="res-head"><span>Nome</span><span>Usi rimasti</span><span>Max</span><span>Ricarica</span><span></span></div>` +
      CHAR.resources.map(r=>`
      <div class="res-row" data-id="${r.id}">
        <input type="text" data-f="name" placeholder="Nome (es. Punti Ki)" value="${esc(r.name)}" aria-label="Nome risorsa">
        <div class="res-use">${usageHtml(r)}<span class="res-left">${Math.min(num(r.cur),num(r.max))}/${num(r.max)}</span></div>
        <input type="number" data-f="max" data-nocalc min="0" value="${num(r.max)}" aria-label="Massimo">
        <select data-f="recharge" aria-label="Ricarica">
          <option value="short"${r.recharge==='short'?' selected':''}>Riposo breve</option>
          <option value="long"${r.recharge==='long'?' selected':''}>Riposo lungo</option>
          <option value=""${!r.recharge?' selected':''}>Nessuna</option>
        </select>
        <button class="icon-btn" data-del title="Rimuovi">✕</button>
      </div>`).join('');
  }
  function refreshRow(r){
    const row = document.querySelector(`.res-row[data-id="${r.id}"] .res-use`);
    if(row) row.innerHTML = usageHtml(r) + `<span class="res-left">${Math.min(num(r.cur),num(r.max))}/${num(r.max)}</span>`;
  }
  const findRes = el => { const row = el.closest('.res-row'); return row && CHAR.resources.find(x=>x.id===row.dataset.id); };

  document.addEventListener('input', e=>{
    if(!e.target.closest('.res-row')) return;
    const r = findRes(e.target); if(!r) return;
    const f = e.target.dataset.f;
    if(f === 'max'){
      const was = num(r.max); r.max = Math.max(0, num(e.target.value));
      if(num(r.cur) >= was || num(r.cur) > r.max) r.cur = r.max;   // se era pieno resta pieno
      refreshRow(r);
    } else if(f){ r[f] = e.target.value; }
    markSaving();
  });
  document.addEventListener('change', e=>{
    if(e.target.matches('.res-row select')){ const r = findRes(e.target); if(r){ r.recharge = e.target.value; markSaving(); } }
  });
  document.addEventListener('click', e=>{
    const t = e.target.closest('.res-row button'); if(!t) return;
    const r = findRes(t); if(!r) return;
    if(t.hasAttribute('data-del')){
      if(r.name && !confirm(`Rimuovere «${r.name}»?`)) return;
      CHAR.resources = CHAR.resources.filter(x=>x!==r); renderResourcesEditor(); markSaving(); return;
    }
    if(t.dataset.k){ const k = num(t.dataset.k); r.cur = (num(r.cur) === k) ? k-1 : k; }   // clic sull'ultimo pieno = lo spendi
    else if(t.dataset.step){ r.cur = Math.max(0, Math.min(num(r.max), num(r.cur) + num(t.dataset.step))); }
    refreshRow(r); markSaving();
  });
  $('btnAddResource').addEventListener('click', ()=>{
    CHAR.resources.push({id:uid(), name:'', max:1, cur:1, recharge:'long'});
    renderResourcesEditor(); markSaving();
    const names = document.querySelectorAll('.res-row input[data-f="name"]'); names[names.length-1].focus();
  });

  // i riposi ricaricano anche le risorse (oltre ai consumabili)
  const origRecharge = rechargeConsumables;
  rechargeConsumables = function(kinds){
    let n = origRecharge(kinds);
    CHAR.resources.forEach(r=>{ if(kinds.includes(r.recharge) && num(r.cur) < num(r.max)){ r.cur = num(r.max); n++; } });
    renderResourcesEditor();
    return n;
  };
  // import/reset del personaggio
  const origRenderAll = renderAll;
  renderAll = function(){ origRenderAll(); ensureResources(); renderResourcesEditor(); };
  renderResourcesEditor();

  /* =================== 2. LAYOUT A COLONNE =================== */
  const LAYOUT_KEY = 'epsilon_sheet_layout_v1';
  const TITLES = {abilities:'Caratteristiche', saves:'Tiri salvezza', skills:'Abilità', personality:'Personalità',
    combat:'Combattimento', attacks:'Attacchi & armi', inventory:'Inventario', spells:'Incantesimi', features:'Tratti & talenti',
    resources:'Risorse di classe', proficiencies:'Competenze & linguaggi', notes:'Note & background'};
  const cols = {left:$('colLeft'), right:$('colRight')};
  const panelOf = key => document.querySelector(`#sheetCols .panel[data-sec="${key}"]`);
  // disposizione di partenza = quella scritta nell'HTML
  const DEFAULT = {
    split:'narrow',
    left: [...cols.left.querySelectorAll(':scope > .panel[data-sec]')].map(p=>p.dataset.sec),
    right:[...cols.right.querySelectorAll(':scope > .panel[data-sec]')].map(p=>p.dataset.sec)
  };
  let customizing = false;

  function loadLayout(){
    let saved = null;
    try{ saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)); }catch(err){}
    const all = [...DEFAULT.left, ...DEFAULT.right];
    const out = {split:'narrow', left:[], right:[]};
    if(saved && ['narrow','half','wide'].includes(saved.split)) out.split = saved.split;
    const seen = new Set();
    ['left','right'].forEach(c=> (saved && Array.isArray(saved[c]) ? saved[c] : []).forEach(k=>{
      if(all.includes(k) && !seen.has(k)){ out[c].push(k); seen.add(k); }
    }));
    // sezioni non presenti nel salvataggio (es. aggiunte in futuro): nella loro colonna di origine
    ['left','right'].forEach(c=> DEFAULT[c].forEach(k=>{ if(!seen.has(k)) out[c].push(k); }));
    return out;
  }
  let LAYOUT = loadLayout();
  function saveLayout(){ try{ localStorage.setItem(LAYOUT_KEY, JSON.stringify(LAYOUT)); }catch(err){} }

  function applyLayout(){
    ['left','right'].forEach(c=> LAYOUT[c].forEach(k=>{ const p = panelOf(k); if(p) cols[c].appendChild(p); }));
    $('sheetCols').dataset.split = LAYOUT.split;
    document.querySelectorAll('.split-btn').forEach(b=>{
      const on = b.dataset.split === LAYOUT.split; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    if(customizing) refreshTools();
  }
  function where(key){ for(const c of ['left','right']){ const i = LAYOUT[c].indexOf(key); if(i>=0) return {c, i}; } return null; }
  function moveTo(key, col, index){
    const from = where(key); if(!from) return;
    LAYOUT[from.c].splice(from.i, 1);
    LAYOUT[col].splice(Math.max(0, Math.min(LAYOUT[col].length, index)), 0, key);
    saveLayout(); applyLayout();
  }

  // barra di controllo in cima a ogni sezione (solo durante la personalizzazione)
  function refreshTools(){
    ['left','right'].forEach(c=> LAYOUT[c].forEach((k, i)=>{
      const p = panelOf(k); if(!p) return;
      let bar = p.querySelector(':scope > .sec-tools');
      if(!bar){ bar = document.createElement('div'); bar.className = 'sec-tools'; p.prepend(bar); }
      const other = c === 'left' ? 'destra' : 'sinistra';
      bar.innerHTML = `
        <span class="sec-grip" title="Trascina per spostare" aria-hidden="true">⠿</span>
        <span class="sec-name">Sposta</span>
        <button data-lay="up" data-key="${k}" ${i===0?'disabled':''} aria-label="Sposta su ${TITLES[k]}">↑</button>
        <button data-lay="down" data-key="${k}" ${i===LAYOUT[c].length-1?'disabled':''} aria-label="Sposta giù ${TITLES[k]}">↓</button>
        <button data-lay="swap" data-key="${k}" class="sec-swap" aria-label="Sposta ${TITLES[k]} nella colonna ${other}">${c==='left'?'Colonna destra →':'← Colonna sinistra'}</button>`;
      p.setAttribute('draggable', 'true');
    }));
  }
  function setCustomizing(on){
    customizing = on;
    document.body.classList.toggle('layout-editing', on);
    const b = $('btnLayout');
    b.textContent = on ? 'Fine' : 'Personalizza layout';
    b.classList.toggle('primary', on); b.setAttribute('aria-pressed', on);
    $('btnLayoutReset').hidden = !on; $('layoutSplit').hidden = !on; $('layoutHint').hidden = !on;
    if(on) refreshTools();
    else document.querySelectorAll('#sheetCols .sec-tools').forEach(t=>{ t.parentElement.removeAttribute('draggable'); t.remove(); });
  }
  $('btnLayout').addEventListener('click', ()=> setCustomizing(!customizing));
  $('btnLayoutReset').addEventListener('click', ()=>{
    if(!confirm('Ripristinare la disposizione predefinita delle sezioni?')) return;
    LAYOUT = {split:DEFAULT.split, left:[...DEFAULT.left], right:[...DEFAULT.right]}; saveLayout(); applyLayout();
  });
  document.querySelectorAll('.split-btn').forEach(b=> b.addEventListener('click', ()=>{ LAYOUT.split = b.dataset.split; saveLayout(); applyLayout(); }));
  document.addEventListener('click', e=>{
    const t = e.target.closest('.sec-tools button'); if(!t) return;
    const k = t.dataset.key, pos = where(k); if(!pos) return;
    if(t.dataset.lay === 'up') moveTo(k, pos.c, pos.i - 1);
    else if(t.dataset.lay === 'down') moveTo(k, pos.c, pos.i + 1);
    else moveTo(k, pos.c === 'left' ? 'right' : 'left', 0);
    const again = document.querySelector(`.sec-tools [data-lay="${t.dataset.lay}"][data-key="${k}"]`);
    if(again && !again.disabled) again.focus();
  });

  // trascinamento: sopra/sotto una sezione, oppure nello spazio vuoto di una colonna
  let dragKey = null;
  const clearMarks = () => document.querySelectorAll('.drop-above,.drop-below,.drop-col').forEach(el=>el.classList.remove('drop-above','drop-below','drop-col'));
  document.addEventListener('dragstart', e=>{
    if(!customizing) return;
    const p = e.target.closest && e.target.closest('#sheetCols .panel[data-sec]'); if(!p) return;
    dragKey = p.dataset.sec; p.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try{ e.dataTransfer.setData('text/plain', dragKey); }catch(err){}
  });
  document.addEventListener('dragover', e=>{
    if(!dragKey) return;
    const col = e.target.closest('#sheetCols .sheet-col'); if(!col) return;
    e.preventDefault(); clearMarks();
    const p = e.target.closest('.panel[data-sec]');
    if(p && p.dataset.sec !== dragKey){
      const r = p.getBoundingClientRect();
      p.classList.add((e.clientY - r.top) < r.height/2 ? 'drop-above' : 'drop-below');
    } else if(!p){ col.classList.add('drop-col'); }
  });
  document.addEventListener('drop', e=>{
    if(!dragKey) return;
    const col = e.target.closest('#sheetCols .sheet-col'); if(!col) return;
    e.preventDefault();
    const k = dragKey, c = col.dataset.col;
    const p = e.target.closest('.panel[data-sec]');
    let idx = LAYOUT[c].length;
    if(p && p.dataset.sec !== k){
      idx = LAYOUT[c].indexOf(p.dataset.sec) + (p.classList.contains('drop-below') ? 1 : 0);
      const from = where(k); if(from.c === c && from.i < idx) idx--;
    } else if(p) return;
    dragKey = null; clearMarks(); moveTo(k, c, idx);
  });
  document.addEventListener('dragend', ()=>{ dragKey = null; clearMarks(); document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging')); });

  applyLayout();
})();
