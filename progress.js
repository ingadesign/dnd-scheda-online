/* =========================================================
   PROGRESSIONE — XP, salita di livello e piano dei livelli
   ---------------------------------------------------------
   1. ClassInfo: classe base 5e (anche per le classi Epsilon,
      tramite "Basato su"), dado vita, privilegi per livello.
   2. Barra XP sotto «Punti Esperienza»: livello raggiunto con
      gli XP e quanti ne mancano al prossimo. Opzione Milestone.
   3. Piano livelli 1–20: per ogni livello i privilegi della
      classe (dal database) e un appunto con le scelte pensate
      (incantesimi, talenti, sottoclasse…). Quando il livello
      sale, la scheda ricorda cosa avevi pianificato.
   Dati aggiunti al personaggio: CHAR.meta.milestone (bool),
   CHAR.levelPlan = {"5": "testo"}.
   ========================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => escapeHtml(String(s ?? ''));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const num = v => Number(v) || 0;

  /* ================= 1. CLASSI ================= */
  const ALIAS = {bardo:'Bard', chierico:'Cleric', stregone:'Sorcerer', mago:'Wizard', druido:'Druid', guerriero:'Fighter',
    paladino:'Paladin', ladro:'Rogue', monaco:'Monk', barbaro:'Barbarian', ranger:'Ranger', warlock:'Warlock', artefice:'Artificer'};
  const HIT_DIE = {Barbarian:12, Fighter:10, Paladin:10, Ranger:10, Bard:8, Cleric:8, Druid:8, Monk:8, Rogue:8, Warlock:8, Artificer:8, Sorcerer:6, Wizard:6};
  const ENGLISH = Object.keys(HIT_DIE);

  function base(name){
    const n = norm(name); if(!n) return '';
    const classes = allEntries('classes');
    const e = classes.find(x => norm(x.name) === n);
    if(e && e.fields && e.fields['Basato su']){
      const first = String(e.fields['Basato su']).split(/[,(/]| or /)[0].trim();
      return ALIAS[norm(first)] || ENGLISH.find(x => norm(x) === norm(first)) || first;
    }
    return ALIAS[n] || ENGLISH.find(x => norm(x) === n) || (e ? e.name : name);
  }
  function hitDie(name){
    const b = base(name);
    const e = allEntries('classes').find(x => x.name === b && x.fields && x.fields['Hit Die']);
    const m = e && String(e.fields['Hit Die']).match(/d(\d+)/);
    return m ? Number(m[1]) : (HIT_DIE[b] || 8);
  }
  function featuresAt(name, level, subclass){
    const b = base(name); if(!b) return [];
    const t = norm(subclass);
    const okSub = x => !x.fields.Subclass || (t && (norm(x.fields.Subclass) === t || norm(x.fields.Subclass).includes(t) || t.includes(norm(x.fields.Subclass))));
    return allEntries('classes').filter(x => x.fields && String(x.fields.Class || x.subcategory) === b && x.name !== b && num(x.fields.Level) === level && !x.fields.Variant && okSub(x));
  }
  window.ClassInfo = {base, hitDie, featuresAt};

  /* ================= 2. XP ================= */
  const XP = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
  const levelFromXp = xp => { let l = 1; XP.forEach((t, i) => { if(xp >= t) l = i + 1; }); return l; };

  const xpInput = $('f_xp');
  const xpBox = document.createElement('div');
  xpBox.className = 'xp-box';
  xpInput.insertAdjacentElement('afterend', xpBox);

  function renderXp(){
    const ms = !!CHAR.meta.milestone;
    xpInput.hidden = ms;
    const lvl = totalLevel(), xp = num(CHAR.meta.xp);
    const fromXp = levelFromXp(xp);
    let html = '';
    if(ms){
      html = `<div class="xp-line">Milestone: il master decide quando sali.</div>`;
    } else if(lvl >= 20){
      html = `<div class="xp-line">Livello massimo</div>`;
    } else {
      const from = XP[lvl - 1] ?? 0, to = XP[lvl];
      const pct = Math.max(0, Math.min(100, (xp - from) / (to - from) * 100));
      html = `<div class="xp-bar" title="${xp} / ${to} XP"><span style="width:${pct}%"></span></div>
        <div class="xp-line">${xp >= to ? '' : `Mancano <b>${(to - xp).toLocaleString('it-IT')}</b> al liv. ${lvl + 1}`}</div>`;
      if(fromXp > lvl) html += `<button class="btn small primary xp-up" data-plan-open>⬆ Puoi salire al liv. ${lvl + 1}</button>`;
    }
    html += `<label class="inline-check xp-ms"><input type="checkbox" id="f_milestone" ${ms ? 'checked' : ''}> Milestone</label>`;
    xpBox.innerHTML = html;
  }
  xpBox.addEventListener('change', e => {
    if(e.target.id === 'f_milestone'){ CHAR.meta.milestone = e.target.checked; markSaving(); renderXp(); }
  });
  xpInput.addEventListener('input', renderXp);
  xpInput.addEventListener('change', renderXp);

  /* ================= 3. PIANO LIVELLI ================= */
  const modal = document.createElement('div');
  modal.className = 'modal-overlay'; modal.id = 'planModal';
  modal.innerHTML = `<div class="modal modal-wide">
      <button class="close-x" data-close="planModal" aria-label="Chiudi">✕</button>
      <h3>Piano dei livelli</h3>
      <p class="small-note" style="font-size:0.8125rem;">Per ogni livello vedi i privilegi della classe e puoi scrivere cosa sceglierai (incantesimi, talento, sottoclasse…). Quando sali di livello la scheda te lo ricorda.</p>
      <div class="plan-levelup" id="planLevelUp"></div>
      <div class="plan-list" id="planList"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal || e.target.closest('[data-close]')) closeModal('planModal'); });

  function planClass(){ return (CHAR.meta.classes.find(c => c.name) || CHAR.meta.classes[0] || {}).name || ''; }

  function renderPlan(){
    if(!CHAR.levelPlan || typeof CHAR.levelPlan !== 'object') CHAR.levelPlan = {};
    const lvl = totalLevel(), cls = planClass();
    const classes = CHAR.meta.classes;
    $('planLevelUp').innerHTML = lvl >= 20 ? '' : `
      <span>Livello attuale <b>${lvl}</b></span>
      ${classes.length > 1 ? `<select id="planUpClass" aria-label="Classe che sale di livello">${classes.map((c, i) => `<option value="${i}">${esc(c.name || 'Classe ' + (i + 1))} (liv. ${num(c.level)})</option>`).join('')}</select>` : ''}
      <button class="btn small primary" id="planUpBtn">⬆ Sali al livello ${lvl + 1}</button>`;
    const first = classes.find(c => c.name) || {};
    let classLvl = 0;
    $('planList').innerHTML = Array.from({length: 20}, (_, i) => {
      const L = i + 1;
      // con una sola classe il livello del personaggio coincide con quello di classe
      classLvl = classes.length > 1 ? (L <= num(first.level) ? L : null) : L;
      const feats = cls && classLvl ? featuresAt(cls, classLvl, first.subclass) : [];
      const state = L <= lvl ? 'done' : L === lvl + 1 ? 'next' : '';
      return `<div class="plan-row ${state}">
        <div class="plan-lvl">${L}${state === 'next' ? '<small>prossimo</small>' : ''}</div>
        <div class="plan-feats">${feats.length ? feats.map(f => `<button class="chip" data-entry="${f.id}">${esc(f.name)}</button>`).join('') : `<span class="small-note">${cls ? '—' : 'Scrivi una classe per vedere i privilegi'}</span>`}</div>
        <textarea data-plan="${L}" rows="1" placeholder="Cosa scegli a questo livello?" aria-label="Piano per il livello ${L}">${esc(CHAR.levelPlan[L] || '')}</textarea>
      </div>`;
    }).join('');
  }
  function openPlan(){
    renderPlan(); openModal('planModal');
    const next = modal.querySelector('.plan-row.next');
    if(next) next.scrollIntoView({block: 'center'});
  }
  modal.addEventListener('input', e => {
    const L = e.target.dataset.plan; if(!L) return;
    CHAR.levelPlan[L] = e.target.value; markSaving();
  });
  modal.addEventListener('click', e => {
    const chip = e.target.closest('[data-entry]');
    if(chip){ showEntryModal('classes', chip.dataset.entry); return; }
    if(e.target.id === 'planUpBtn'){
      const sel = $('planUpClass'); const i = sel ? num(sel.value) : 0;
      const c = CHAR.meta.classes[i]; if(!c) return;
      c.level = Math.min(20, num(c.level) + 1);
      renderClasses(); renderComputed(); markSaving();
      // extra.js ascolta i cambi in #classesList per aggiornare i privilegi
      const inp = document.querySelectorAll('#classesList input[type=number]')[i];
      if(inp) inp.dispatchEvent(new Event('change', {bubbles: true}));
      renderPlan(); levelChanged();
    }
  });
  document.addEventListener('click', e => { if(e.target.closest('[data-plan-open]')) openPlan(); });

  // pulsante nella scheda, accanto a «+ Aggiungi classe»
  const addCls = $('btnAddClass');
  if(addCls){
    const b = document.createElement('button');
    b.className = 'btn small'; b.textContent = '✦ Piano livelli'; b.setAttribute('data-plan-open', '');
    const wrap = document.createElement('div'); wrap.className = 'toolbar-group';
    addCls.parentElement.insertBefore(wrap, addCls); wrap.append(b, addCls);
  }

  /* quando il livello totale sale: ricorda il piano */
  let lastLevel = totalLevel();
  function levelChanged(){
    const now = totalLevel();
    if(now > lastLevel){
      const plan = (CHAR.levelPlan || {})[now];
      toast(plan ? `⬆ Livello ${now} — dal tuo piano: ${plan.slice(0, 90)}` : `⬆ Livello ${now}! Ricorda: PF, privilegi e incantesimi nuovi.`);
    }
    lastLevel = now; renderXp();
    if(window.Session) Session.refresh();
  }
  document.addEventListener('change', e => { if(e.target.closest('#classesList')) setTimeout(levelChanged, 60); });

  const origRenderAll = renderAll;
  renderAll = function(){ origRenderAll(); lastLevel = totalLevel(); renderXp(); };
  renderXp();
  window.Progress = {renderXp, openPlan};
})();
