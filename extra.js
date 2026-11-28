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
          <option value="short1"${r.recharge==='short1'?' selected':''}>1 al breve, tutte al lungo</option>
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
    const isLong = kinds.includes('long');
    CHAR.resources.forEach(r=>{
      const mx = num(r.max), cu = num(r.cur);
      if(cu >= mx) return;
      if(r.recharge === 'short1'){ r.cur = isLong ? mx : cu + 1; n++; }        // es. Channel Divinity
      else if(kinds.includes(r.recharge)){ r.cur = mx; n++; }
    });
    renderResourcesEditor();
    return n;
  };
  // import/reset del personaggio
  const origRenderAll = renderAll;
  renderAll = function(){ origRenderAll(); ensureResources(); renderResourcesEditor(); };
  renderResourcesEditor();
  window.renderResourcesEditor = renderResourcesEditor;
  window.ensureResources = ensureResources;

  /* =================== 2. LAYOUT A COLONNE =================== */
  const LAYOUT_KEY = 'epsilon_sheet_layout_v1';
  const TITLES = {abilities:'Caratteristiche', saves:'Tiri salvezza', skills:'Abilità', personality:'Personalità',
    combat:'Combattimento', attacks:'Attacchi & armi', inventory:'Inventario', spells:'Incantesimi', features:'Tratti & talenti',
    resources:'Risorse di classe', companions:'Compagni', proficiencies:'Competenze & linguaggi', notes:'Note & background'};
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


/* =========================================================
   3. PRIVILEGI DI CLASSE AUTOMATICI
   Quando nella scheda si scrive una classe (e il suo livello),
   i privilegi fino a quel livello finiscono in "Tratti & talenti"
   (fonte: Classe) e quelli con usi limitati anche in "Risorse di
   classe". Se il livello scende o la classe cambia, si aggiornano.
   - Le classi Epsilon caricano i privilegi della classe su cui si
     basano (campo "Basato su", es. Netrunner -> Wizard).
   - I privilegi aggiunti a mano non vengono mai toccati.
   - Un privilegio automatico cancellato a mano non torna più
     (finché non si preme "↻ Privilegi di classe").
   ========================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const num = v => Number(v) || 0;
  const norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const EPS = 'Adattamenti Epsilon';
  const ALIAS = {bardo:'Bard', chierico:'Cleric', stregone:'Sorcerer', mago:'Wizard', druido:'Druid', guerriero:'Fighter',
    paladino:'Paladin', ladro:'Rogue', monaco:'Monk', barbaro:'Barbarian', ranger:'Ranger', warlock:'Warlock', artefice:'Artificer'};

  const classEntries = () => allEntries('classes');
  // una voce è una CLASSE (non un privilegio) se è un adattamento Epsilon, o se il nome coincide con la sua classe (Bard/Bard)
  const isClass = e => e.subcategory === EPS || (e.subcategory && e.name === e.subcategory) ||
                       (e.custom && !(e.fields && (e.fields.Level || e.fields.Feature || e.fields.Class)));
  const findClass = name => {
    const n = norm(name); if(!n) return null;
    const list = classEntries().filter(isClass);
    return list.find(e=>norm(e.name)===n) || (ALIAS[n] && list.find(e=>e.name===ALIAS[n])) || null;
  };
  // privilegi della classe base (esclusi quelli di sottoclasse e le varianti homebrew)
  const featuresOf = base => classEntries().filter(e=> e.subcategory===base && e.name!==base && e.fields && e.fields.Level && !e.fields.Subclass && !e.fields.Variant);
  // privilegi della sottoclasse scelta nella riga (campo "Sottoclasse"), riconosciuta anche scritta in parte
  function subclassName(base, typed){
    const t = norm(typed); if(!t) return null;
    const subs = [...new Set(classEntries().filter(e=> e.subcategory===base && e.fields && e.fields.Subclass).map(e=> e.fields.Subclass))];
    return subs.find(s=> norm(s)===t) || subs.find(s=> norm(s).includes(t) || t.includes(norm(s))) || null;
  }
  const subFeaturesOf = (base, sub) => sub ? classEntries().filter(e=> e.subcategory===base && e.fields && e.fields.Level && e.fields.Subclass===sub && !e.fields.Variant) : [];
  // classe 5e da cui prendere i privilegi: la classe stessa, o "Basato su" per le Epsilon
  function baseOf(row){
    const e = findClass(row.name);
    const n = norm(row.name);
    const candidates = e ? (e.subcategory===EPS ? String((e.fields||{})['Basato su']||'').split(/[,(/]| or /) : [e.name]) : [ALIAS[n]||row.name];
    for(const c of candidates){ const b = c.trim(); if(b && featuresOf(b).length) return {base:b, entry:e}; }
    return {base:null, entry:e};
  }
  // numero dalla tabella della classe (es. colonna "Channel Divinity" al livello N)
  function tableValue(base, column, level){
    const cls = classEntries().find(e=>e.name===base && e.subcategory===base); if(!cls) return null;
    const rows = String(cls.body||'').split('\n').filter(l=>l.trim().startsWith('|'));
    if(rows.length < 3) return null;
    const head = rows[0].split('|').map(x=>norm(x));
    const ci = head.indexOf(norm(column)); if(ci < 0) return null;
    let val = null;
    rows.slice(2).forEach(r=>{ const c = r.split('|'); if(num(c[1]) && num(c[1]) <= level && /\d/.test(c[ci]||'')) val = num(String(c[ci]).replace(/[^\d]/g,'')); });
    return val;
  }
  const chaMod = () => Math.max(1, mod(num(CHAR.abilities.cha) || 10));
  // privilegi con usi limitati -> contatore. Numeri presi dai testi del vault.
  const RESOURCE_RULES = {
    'Bardic Inspiration':   (lv)=>({max: chaMod(), recharge: lv>=5 ? 'short' : 'long'}),            // Font of Inspiration dal 5
    'Channel Divinity':     (lv,b)=>({max: tableValue(b,'Channel Divinity',lv) || (lv>=18?4:lv>=6?3:2), recharge:'short1'}),
    'Divine Intervention':  ()=>({max:1, recharge:'long'}),
    'Font of Magic':        (lv,b)=>({name:'Sorcery Points', max: tableValue(b,'Sorcery Points',lv) || lv, recharge:'long'}),
    'Innate Sorcery':       ()=>({max:2, recharge:'long'}),
    'Sorcerous Restoration':()=>({max:1, recharge:'long'}),
    'Arcane Recovery':      ()=>({max:1, recharge:'long'}),
    'Signature Spells':     ()=>({max:2, recharge:'short'}),
    // pronte per le classi che aggiungerai con la Forgia
    'Rage':                 (lv,b)=>({max: tableValue(b,'Rages',lv) || 2, recharge:'short1'}),
    "Monk's Focus":         (lv,b)=>({name:'Focus Points', max: tableValue(b,'Focus Points',lv) || lv, recharge:'short'}),
    'Second Wind':          (lv,b)=>({max: tableValue(b,'Second Wind',lv) || 2, recharge:'short1'}),
    'Action Surge':         (lv)=>({max: lv>=17?2:1, recharge:'short'}),
    'Lay On Hands':         (lv)=>({max: 5*lv, recharge:'long'}),
    'Wild Shape':           (lv,b)=>({max: tableValue(b,'Wild Shape',lv) || 2, recharge:'short1'}),
  };
  const plainName = n => String(n).replace(/\s*\([^)]*\)\s*$/,'');   // "Spellcasting (Bard)" -> "Spellcasting"

  function state(){
    if(!CHAR.autoClass) CHAR.autoClass = {};
    ['feat','res'].forEach(k=>{ if(!CHAR.autoClass[k]) CHAR.autoClass[k] = {applied:[], dismissed:[]}; });
    return CHAR.autoClass;
  }

  // cosa DOVREBBE esserci adesso, in base a classi, livelli e Carisma
  function desired(){
    const feats = [], res = [];
    (CHAR.meta.classes||[]).forEach((row, ri)=>{
      const lv = Math.max(1, num(row.level));
      if(!String(row.name||'').trim()) return;
      const {base, entry} = baseOf(row);
      const label = entry ? entry.name : row.name;
      if(entry && entry.subcategory === EPS){     // il tratto della classe Epsilon stessa
        const f = entry.fields || {};
        const desc = [f['Basato su'] ? `*Basata su ${f['Basato su']}*` : '', f.Vantaggio ? `**Vantaggio.** ${f.Vantaggio}` : '', entry.body||''].filter(Boolean).join('\n\n');
        feats.push({key:`${label}|${entry.name}`, name:entry.name, desc, level:0, order:ri});
      }
      if(!base) return;
      const sub = subclassName(base, row.subclass);
      featuresOf(base).concat(subFeaturesOf(base, sub)).forEach(e=>{
        const flv = num(e.fields.Level); if(flv > lv) return;
        const who = e.fields.Subclass ? `${base} · ${e.fields.Subclass}` : base;
        feats.push({key:`${label}|${e.name}`, name:e.name, desc:`*${who} · livello ${flv}*\n\n${e.body||''}`, level:flv, order:ri});
        const rule = RESOURCE_RULES[plainName(e.name)];
        if(rule){
          const r = rule(lv, base);
          res.push({key:`${label}|${plainName(e.name)}`, name: r.name || plainName(e.name), max:r.max, recharge:r.recharge});
        }
      });
    });
    feats.sort((a,b)=> a.order-b.order || a.level-b.level);
    return {feats, res};
  }

  function sync(opts = {}){
    if(typeof CHAR === 'undefined' || !Array.isArray(CHAR.features)) return;
    window.ensureResources && ensureResources();
    const st = state(), want = desired();
    const added = [], removed = [];
    let resChanged = false;

    /* ---- tratti ---- */
    // un automatico che non c'è più = cancellato a mano: non va riaggiunto
    const present = new Set(CHAR.features.filter(f=>f.autoKey).map(f=>f.autoKey));
    st.feat.applied.forEach(k=>{ if(!present.has(k) && !st.feat.dismissed.includes(k)) st.feat.dismissed.push(k); });
    const wantKeys = new Set(want.feats.map(f=>f.key));
    // via quelli non più dovuti (livello sceso, classe cambiata); quelli "adottati" tornano manuali
    CHAR.features = CHAR.features.filter(f=>{
      if(!f.autoKey || wantKeys.has(f.autoKey)) return true;
      if(f.autoAdopted){ delete f.autoKey; delete f.autoAdopted; return true; }
      removed.push(f.name); return false;
    });
    want.feats.forEach(w=>{
      if(st.feat.dismissed.includes(w.key) || CHAR.features.some(f=>f.autoKey===w.key)) return;
      const twin = CHAR.features.find(f=>!f.autoKey && norm(plainName(f.name))===norm(plainName(w.name)));
      if(twin){ twin.autoKey = w.key; twin.autoAdopted = true; return; }   // già scritto a mano: lo adotto, non lo duplico
      CHAR.features.push({name:w.name, desc:w.desc, source:'Classe', expanded:false, autoKey:w.key});
      added.push(w.name);
    });
    st.feat.applied = CHAR.features.filter(f=>f.autoKey).map(f=>f.autoKey);
    st.feat.dismissed = st.feat.dismissed.filter(k=> wantKeys.has(k));   // dimentica i "cancellati" di classi tolte

    /* ---- risorse ---- */
    const presentR = new Set(CHAR.resources.filter(r=>r.autoKey).map(r=>r.autoKey));
    st.res.applied.forEach(k=>{ if(!presentR.has(k) && !st.res.dismissed.includes(k)) st.res.dismissed.push(k); });
    const wantR = new Map(want.res.map(r=>[r.key, r]));
    CHAR.resources = CHAR.resources.filter(r=>{
      if(!r.autoKey || wantR.has(r.autoKey)) return true;
      if(r.autoAdopted){ delete r.autoKey; delete r.autoAdopted; return true; }
      resChanged = true; return false;
    });
    want.res.forEach(w=>{
      if(st.res.dismissed.includes(w.key)) return;
      let r = CHAR.resources.find(x=>x.autoKey===w.key);
      if(!r){
        r = CHAR.resources.find(x=>!x.autoKey && norm(x.name)===norm(w.name));
        if(r){ r.autoKey = w.key; r.autoAdopted = true; }
      }
      if(!r){ CHAR.resources.push({id:uid(), name:w.name, max:w.max, cur:w.max, recharge:w.recharge, autoKey:w.key}); resChanged = true; return; }
      if(num(r.max) !== w.max){                       // il massimo segue livello / Carisma
        r.cur = num(r.cur) >= num(r.max) ? w.max : Math.min(num(r.cur), w.max);
        r.max = w.max; resChanged = true;
      }
      if(r.autoKey === w.key && !r.autoAdopted && r.recharge !== w.recharge){ r.recharge = w.recharge; resChanged = true; }
    });
    st.res.applied = CHAR.resources.filter(r=>r.autoKey).map(r=>r.autoKey);
    st.res.dismissed = st.res.dismissed.filter(k=> wantR.has(k));

    if(added.length || removed.length || resChanged){
      renderFeatures(); window.renderResourcesEditor && renderResourcesEditor(); markSaving();
      if(!opts.silent && (added.length || removed.length)){
        const parts = [];
        if(added.length) parts.push(`${added.length} ${added.length===1?'privilegio aggiunto':'privilegi aggiunti'}`);
        if(removed.length) parts.push(`${removed.length} ${removed.length===1?'privilegio tolto':'privilegi tolti'}`);
        toast('Classe aggiornata: ' + parts.join(', '));
      }
    }
  }
  window.syncClassFeatures = sync;
  // sottoclassi disponibili per una classe (per il menu a tendina della riga)
  window.subclassesFor = function(name){
    const {base} = baseOf({name}); if(!base) return [];
    return classEntries().filter(e=> e.subcategory===base && e.fields && e.fields.Subclass && e.fields.Summary).map(e=> e.fields.Subclass).sort((a,b)=>a.localeCompare(b,'it'));
  };

  /* ---- solo classi vere nel menu a tendina ---- */
  function fillClassList(){
    const dl = $('classSuggestions'); if(!dl) return;
    const names = classEntries().filter(isClass).map(e=>e.name).sort((a,b)=>a.localeCompare(b,'it'));
    dl.innerHTML = [...new Set(names)].map(n=>`<option value="${escapeHtml(n)}">`).join('');
  }

  /* ---- quando aggiornare ---- */
  let t = 0;
  const later = (ms=500) => { clearTimeout(t); t = setTimeout(()=>sync(), ms); };
  document.addEventListener('change', e=>{ if(e.target.closest('#classesList') || e.target.closest('#abilitiesGrid')) later(50); });
  document.addEventListener('input', e=>{ if(e.target.matches('#classesList input[type=number]')) later(600); });
  // in fase di cattura: la ✕ ridisegna la riga e dopo il clic non sarebbe più riconoscibile
  document.addEventListener('click', e=>{ if(e.target.closest('#classesList .icon-btn') || e.target.closest('#btnAddClass')) later(50); }, true);

  // bottone per ricaricare anche quelli cancellati a mano
  const addBtn = $('btnAddFeature');
  if(addBtn){
    const b = document.createElement('button');
    b.className = 'btn small'; b.id = 'btnSyncClass'; b.textContent = '↻ Privilegi di classe';
    b.title = 'Ricarica i privilegi della tua classe fino al tuo livello, anche quelli che avevi cancellato';
    b.addEventListener('click', ()=>{
      const st = state(); st.feat.dismissed = []; st.res.dismissed = [];
      sync({silent:true}); toast('Privilegi di classe ricaricati');
    });
    addBtn.parentElement.insertBefore(b, addBtn.parentElement.firstChild);
  }

  const origRenderAll = renderAll;
  renderAll = function(){ origRenderAll(); fillClassList(); sync({silent:true}); };
  fillClassList();
  if(typeof renderClasses === 'function') renderClasses();   // per riempire i menu delle sottoclassi
  sync({silent:true});
})();

/* Salvataggio immediato quando si chiude/ricarica la pagina:
   il salvataggio normale aspetta ~0,35 s dopo l'ultima modifica. */
window.addEventListener('pagehide', ()=>{ try{ localStorage.setItem(SHEET_KEY, JSON.stringify(CHAR)); }catch(e){} });
