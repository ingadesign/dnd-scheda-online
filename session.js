/* =========================================================
   MODALITÀ SESSIONE — la scheda pronta per il tavolo
   ---------------------------------------------------------
   Interruttore «✎ Scheda | ⚔ Sessione» sopra la scheda.
   - Scheda: tutto modificabile (come prima).
   - Sessione: tre colonne con solo ciò che serve in gioco:
     PF con −/+ rapidi, TS contro la morte, concentrazione,
     condizioni, dadi vita, compagni · attacchi tirabili,
     risorse, consumabili, privilegi · caratteristiche, TS e
     abilità da toccare per tirare, slot e incantesimi.
   Tutto legge e scrive lo stesso CHAR: tornando alla scheda i
   valori sono aggiornati.
   Dati aggiunti: CHAR.conditions = [{id, name, dbId, level}],
   CHAR.combat.concentration = "nome incantesimo" | "",
   CHAR.combat.hitDiceUsed = numero.
   ========================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => escapeHtml(String(s ?? ''));
  const num = v => Number(v) || 0;
  const MODE_KEY = 'epsilon_sheet_mode';
  const AB_SHORT = {str:'FOR', dex:'DES', con:'COS', int:'INT', wis:'SAG', cha:'CAR'};

  /* ================= dati ================= */
  function ensure(){
    if(!Array.isArray(CHAR.conditions)) CHAR.conditions = [];
    if(CHAR.combat.concentration === undefined) CHAR.combat.concentration = '';
    if(CHAR.combat.hitDiceUsed === undefined) CHAR.combat.hitDiceUsed = 0;
  }
  ensure();

  const pb = () => profBonus(totalLevel());
  const abMod = ab => mod(num(CHAR.abilities[ab]) || 10);
  const saveBonus = ab => abMod(ab) + (CHAR.saveProf[ab] ? pb() : 0);
  function skillBonus(key, ab){
    const s = CHAR.skills[key] || {}; return abMod(ab) + (s.exp ? pb() * 2 : s.prof ? pb() : 0);
  }
  // iniziativa e percezione passiva: il valore scritto a mano vince, altrimenti calcolato
  function initBonus(){
    const v = String(CHAR.combat.initiative ?? '').replace(/[−–]/g, '-').trim();
    return v !== '' && !isNaN(Number(v)) ? Number(v) : abMod('dex');
  }
  function passivePerc(){
    const v = String(CHAR.combat.passivePerception ?? '').trim();
    return v !== '' && !isNaN(Number(v)) ? Number(v) : 10 + skillBonus('perception', 'wis');
  }
  function spellStats(){
    const ab = CHAR.spellcasting.ability;
    if(!ab || !ABILITY_LABELS[ab]) return null;
    return {dc: 8 + pb() + abMod(ab), atk: pb() + abMod(ab), ab};
  }
  /* dadi vita: "5d10" = 5 dadi; "d8"/"1d8" = un dado per livello */
  function hitDice(){
    const txt = String(CHAR.combat.hitDice || '');
    const m = txt.match(/(\d*)\s*d\s*(\d+)/i);
    const first = (CHAR.meta.classes.find(c => c.name) || {}).name;
    const die = m ? Number(m[2]) : (window.ClassInfo && first ? ClassInfo.hitDie(first) : 8);
    const n = m && Number(m[1]) > 1 ? Number(m[1]) : Math.max(1, totalLevel());
    return {die, total: n, left: Math.max(0, n - num(CHAR.combat.hitDiceUsed))};
  }
  function concentrationSpell(sp){
    if(sp.concentration) return true;
    if(sp.dbId){ const e = findEntry('spells', sp.dbId); return !!(e && /concentra/i.test((e.fields || {}).Duration || '')); }
    return false;
  }
  function conditionLabel(name){ const p = String(name).split('-'); return p.length > 1 ? p.slice(1).join('-') : name; }

  /* ================= azioni sui PF ================= */
  let concPrompt = null;   // {dc} dopo un danno mentre ci si concentra
  function damage(n){
    const c = CHAR.combat; n = Math.abs(num(n)); if(!n) return;
    const tmp = num(c.hpTemp), absorbed = Math.min(tmp, n);
    c.hpTemp = tmp - absorbed;
    const wasZero = num(c.hpCur) === 0;
    c.hpCur = Math.max(0, num(c.hpCur) - (n - absorbed));
    if(wasZero && num(c.hpMax) > 0){ c.deathFail = Math.min(3, num(c.deathFail) + 1); toast('Danno a 0 PF: un fallimento al TS contro la morte'); }
    else toast(c.hpCur === 0 ? '💀 A 0 PF — tiri salvezza contro la morte!' : `−${n} PF` + (absorbed ? ` (${absorbed} dai temporanei)` : ''));
    if(c.concentration) concPrompt = {dc: Math.min(30, Math.max(10, Math.floor(n / 2)))};
    if(c.hpCur === 0 && c.concentration){ c.concentration = ''; concPrompt = null; toast('A 0 PF: concentrazione persa'); }
    commit();
  }
  function heal(n){
    const c = CHAR.combat; n = Math.abs(num(n)); if(!n) return;
    const max = num(c.hpMax);
    c.hpCur = max ? Math.min(max, num(c.hpCur) + n) : num(c.hpCur) + n;
    if(c.hpCur > 0){ c.deathSuccess = 0; c.deathFail = 0; }
    toast(`+${n} PF`); commit();
  }
  function setTemp(n){
    const c = CHAR.combat; n = Math.max(0, num(n));
    if(n <= num(c.hpTemp) && n !== 0){ toast('I PF temporanei non si sommano: tieni il valore più alto'); return; }
    c.hpTemp = n; commit();
  }
  function commit(){ markSaving(); render(); }

  /* ================= HTML ================= */
  const rollBtn = (label, bonus, attrs, cls = '') => `<button class="roll-btn ${cls}" ${attrs} title="Tira ${esc(label)}">${fmtMod(bonus)}</button>`;

  function vitalsHtml(){
    const c = CHAR.combat;
    const max = Math.max(0, num(c.hpMax)), cur = Math.max(0, num(c.hpCur)), tmp = Math.max(0, num(c.hpTemp));
    const total = Math.max(max, cur) + tmp || 1, pct = max ? cur / max : 0;
    const dying = max > 0 && cur === 0;
    const dots = (n, kind) => Array.from({length: 3}, (_, i) => `<button class="ds-dot ${kind}${i < n ? ' on' : ''}" data-act="ds" data-kind="${kind}" data-i="${i + 1}" aria-label="${kind === 'ok' ? 'Successo' : 'Fallimento'} ${i + 1}"></button>`).join('');
    return `
    <section class="s-card s-hp${dying ? ' dying' : ''}">
      <div class="s-hp-num"><b>${cur}</b><span>/ ${max}</span>${tmp ? `<em>+${tmp} temp</em>` : ''}</div>
      <div class="hp-bar s-hp-bar"><div class="hp-fill${pct <= .25 ? ' low' : pct <= .5 ? ' mid' : ''}" style="width:${cur / total * 100}%"></div><div class="hp-temp" style="left:${cur / total * 100}%;width:${tmp / total * 100}%"></div></div>
      <div class="s-hp-steps">
        ${[-10, -5, -1].map(v => `<button class="step dmg" data-act="hp" data-v="${v}" aria-label="Danno ${-v}">${v}</button>`).join('')}
        ${[1, 5, 10].map(v => `<button class="step heal" data-act="hp" data-v="${v}" aria-label="Cura ${v}">+${v}</button>`).join('')}
      </div>
      <form class="s-hp-custom" data-form="hp">
        <input type="number" min="0" name="v" data-nocalc placeholder="Valore" aria-label="Valore di danno, cura o PF temporanei">
        <button class="btn small hp-dmg" name="a" value="dmg">− Danno</button>
        <button class="btn small hp-heal" name="a" value="heal">+ Cura</button>
        <button class="btn small" name="a" value="temp" title="Imposta i PF temporanei">Temp</button>
      </form>
      <div class="s-death${dying ? ' show' : ''}">
        <div><span>Successi</span>${dots(num(c.deathSuccess), 'ok')}</div>
        <div><span>Fallimenti</span>${dots(num(c.deathFail), 'ko')}</div>
        ${dying ? `<button class="btn small primary" data-act="deathroll">Tira TS contro la morte</button>` : ''}
      </div>
    </section>`;
  }

  function statsHtml(){
    const c = CHAR.combat;
    return `<section class="s-stats">
      <div class="s-stat"><label>CA</label><b>${num(c.ac)}</b></div>
      <button class="s-stat roll" data-act="init" title="Tira l'iniziativa"><label>Iniziativa</label><b>${fmtMod(initBonus())}</b></button>
      <div class="s-stat"><label>Velocità</label><b>${num(CHAR.meta.speed)}<small> m</small></b></div>
      <div class="s-stat"><label>Perc. passiva</label><b>${passivePerc()}</b></div>
      <div class="s-stat"><label>Competenza</label><b>${fmtMod(pb())}</b></div>
      <button class="s-stat insp${CHAR.meta.inspiration ? ' on' : ''}" data-act="insp" aria-pressed="${!!CHAR.meta.inspiration}" title="Ispirazione eroica"><label>Ispirazione</label><b>${CHAR.meta.inspiration ? '★' : '☆'}</b></button>
    </section>`;
  }

  function conditionsHtml(){
    const all = allEntries('conditions').slice().sort((a, b) => conditionLabel(a.name).localeCompare(conditionLabel(b.name), 'it'));
    const have = new Set(CHAR.conditions.map(x => x.dbId || x.name));
    return `<div class="cond-chips">${CHAR.conditions.length ? CHAR.conditions.map(x => {
        const ex = /esaust|exhaust/i.test(x.name);
        return `<span class="cond-chip" data-cond="${x.id}">
          <button class="cond-name" data-act="condinfo" title="Leggi l'effetto">${esc(conditionLabel(x.name))}${ex ? ` ${num(x.level) || 1}` : ''}</button>
          ${ex ? `<button class="mini-btn" data-act="exh" data-v="-1" aria-label="Riduci esaustione">−</button><button class="mini-btn" data-act="exh" data-v="1" aria-label="Aumenta esaustione">+</button>` : ''}
          <button class="cond-x" data-act="condrm" aria-label="Rimuovi ${esc(conditionLabel(x.name))}">✕</button></span>`;
      }).join('') : '<span class="small-note">Nessuna condizione attiva</span>'}</div>
      <select class="cond-add" data-act="condadd" aria-label="Aggiungi condizione">
        <option value="">+ Aggiungi condizione…</option>
        ${all.filter(e => !have.has(e.id)).map(e => `<option value="${e.id}">${esc(conditionLabel(e.name))}</option>`).join('')}
      </select>`;
  }

  function concHtml(){
    const c = CHAR.combat;
    return `<div class="conc${c.concentration ? ' on' : ''}">
      <button class="conc-toggle" data-act="conc" aria-pressed="${!!c.concentration}">${c.concentration ? '◉' : '○'} Concentrazione</button>
      ${c.concentration ? `<span class="conc-spell">${esc(c.concentration === true ? '' : c.concentration)}</span>` : ''}
      ${concPrompt ? `<div class="conc-alert">Hai subito danni: TS Costituzione CD ${concPrompt.dc}
        <button class="btn small primary" data-act="concsave">Tira ${fmtMod(saveBonus('con'))}</button>
        <button class="icon-btn" data-act="concdismiss" aria-label="Ignora">✕</button></div>` : ''}
    </div>`;
  }

  function hitDiceHtml(){
    const h = hitDice();
    return `<div class="s-hd">
      <div><label>Dadi vita</label><b>${h.left}</b><small>/${h.total} d${h.die}</small></div>
      <button class="btn small" data-act="hd" ${h.left ? '' : 'disabled'} title="Tira d${h.die} ${fmtMod(abMod('con'))} e recupera PF (riposo breve)">Spendi 1 (d${h.die}${fmtMod(abMod('con'))})</button>
    </div>`;
  }

  function attacksHtml(){
    const ss = spellStats();
    const rows = CHAR.attacks.filter(a => a.name || a.bonus || a.damage).map((a, i) => {
      const hit = String(a.bonus || '').replace(/[−–]/g, '-').match(/[+-]?\s*\d+/);
      return `<div class="s-atk">
        <div class="s-atk-name">${esc(a.name || 'Attacco')}${a.notes ? `<small>${esc(a.notes)}</small>` : ''}</div>
        ${hit ? `<button class="roll-btn" data-act="atk" data-i="${i}" title="Tiro per colpire">${fmtMod(Number(hit[0].replace(/\s/g, '')))}</button>` : ''}
        ${Dice.hasDice(a.damage) ? `<button class="roll-btn dmg" data-act="dmg" data-i="${i}" title="Tiro dei danni">${esc(a.damage)}</button>` : (a.damage ? `<span class="s-atk-dmg">${esc(a.damage)}</span>` : '')}
      </div>`;
    });
    if(ss) rows.push(`<div class="s-atk"><div class="s-atk-name">Attacco con incantesimo<small>CD ${ss.dc}</small></div>
      <button class="roll-btn" data-act="spellatk" title="Tiro per colpire con incantesimo">${fmtMod(ss.atk)}</button></div>`);
    return rows.length ? rows.join('') : '<div class="empty-hint">Nessun attacco. Aggiungilo nella scheda, in «Attacchi & armi».</div>';
  }

  function resourcesHtml(){
    const list = (CHAR.resources || []).filter(r => r.name);
    if(!list.length) return '';
    const rc = {short: 'breve', long: 'lungo', short1: '1 al breve', '': ''};
    return `<section class="s-card"><h4>Risorse</h4>${list.map(r => {
      const mx = num(r.max), cu = Math.min(num(r.cur), mx);
      const pips = mx <= 12 ? Array.from({length: mx}, (_, k) => `<button class="res-pip${k >= cu ? ' used' : ''}" data-act="res" data-id="${r.id}" data-k="${k + 1}" aria-label="${esc(r.name)} ${k + 1} di ${mx}"></button>`).join('')
        : `<button class="mini-btn" data-act="resstep" data-id="${r.id}" data-v="-1" aria-label="Usa">−</button><b>${cu}</b><button class="mini-btn" data-act="resstep" data-id="${r.id}" data-v="1" aria-label="Recupera">+</button>`;
      return `<div class="s-res"><span>${esc(r.name)}<small>${rc[r.recharge] ? 'riposo ' + rc[r.recharge] : ''}</small></span><div class="res-pips">${pips}</div><em>${cu}/${mx}</em></div>`;
    }).join('')}</section>`;
  }

  function consumablesHtml(){
    const list = CHAR.consumables.filter(it => it.name && num(it.qty) > 0);
    if(!list.length) return '';
    return `<section class="s-card"><h4>Consumabili</h4>${list.map(it => `
      <div class="s-cons">
        <span>${esc(it.name)}${it.notes ? `<small>${esc(it.notes)}</small>` : ''}</span>
        ${Dice.hasDice(it.notes) ? `<button class="roll-btn dmg" data-act="consroll" data-id="${it.id}" title="Tira l'effetto">🎲</button>` : ''}
        <b>×${num(it.qty)}</b>
        <button class="btn small" data-act="consuse" data-id="${it.id}">Usa</button>
      </div>`).join('')}</section>`;
  }

  function featuresHtml(){
    const list = CHAR.features.filter(f => f.name);
    if(!list.length) return '';
    return `<section class="s-card"><h4>Privilegi & talenti <small>(${list.length})</small></h4>${list.map(f => `
      <details class="s-feat"><summary>${esc(f.name)}${f.source ? `<small>${esc(f.source)}</small>` : ''}</summary>
      <div class="s-feat-body">${f.desc ? esc(f.desc) : '<span class="small-note">Nessuna descrizione.</span>'}</div></details>`).join('')}</section>`;
  }

  function abilitiesHtml(){
    return `<section class="s-card"><h4>Caratteristiche <small>tocca per tirare</small></h4><div class="s-abil">${Object.keys(ABILITY_LABELS).map(ab => `
      <div class="s-ab">
        <label>${AB_SHORT[ab]}<small>${num(CHAR.abilities[ab])}</small></label>
        <button class="s-ab-mod" data-act="check" data-ab="${ab}" title="Prova di ${ABILITY_LABELS[ab]}">${fmtMod(abMod(ab))}</button>
        <button class="s-ab-save${CHAR.saveProf[ab] ? ' prof' : ''}" data-act="save" data-ab="${ab}" title="Tiro salvezza di ${ABILITY_LABELS[ab]}">TS ${fmtMod(saveBonus(ab))}</button>
      </div>`).join('')}</div></section>`;
  }

  function skillsHtml(){
    return `<section class="s-card"><h4>Abilità</h4><div class="s-skills">${SKILLS.map(([key, ab]) => {
      const s = CHAR.skills[key] || {};
      return `<button class="s-skill${s.exp ? ' exp' : s.prof ? ' prof' : ''}" data-act="skill" data-key="${key}" data-ab="${ab}">
        <i aria-hidden="true">${s.exp ? '◆' : s.prof ? '●' : '○'}</i><span>${esc(SKILL_LABELS[key])}</span><small>${AB_SHORT[ab]}</small><b>${fmtMod(skillBonus(key, ab))}</b></button>`;
    }).join('')}</div></section>`;
  }

  function spellsHtml(){
    const ss = spellStats();
    const slots = [1,2,3,4,5,6,7,8,9].map(n => ({n, s: CHAR.spellcasting.slots[n]})).filter(x => num(x.s.total) > 0);
    const spells = CHAR.spellcasting.spells.filter(sp => sp.name);
    if(!ss && !slots.length && !spells.length) return '';
    const prepared = spells.filter(sp => sp.prepared || spellLevelNum(sp.level) === 0);
    const shown = (prepared.length ? prepared : spells).map(sp => ({sp, i: CHAR.spellcasting.spells.indexOf(sp), L: spellLevelNum(sp.level)}))
      .sort((a, b) => a.L - b.L || a.sp.name.localeCompare(b.sp.name, 'it'));
    const groups = {};
    shown.forEach(x => (groups[x.L] = groups[x.L] || []).push(x));
    return `<section class="s-card"><h4>Incantesimi</h4>
      ${ss ? `<div class="s-spellstats"><div><label>CD</label><b>${ss.dc}</b></div>
        <button class="roll" data-act="spellatk"><label>Attacco</label><b>${fmtMod(ss.atk)}</b></button>
        <div><label>Abilità</label><b>${AB_SHORT[ss.ab]}</b></div></div>` : ''}
      ${slots.length ? `<div class="s-slots">${slots.map(({n, s}) => `
        <div class="s-slot"><label>${n}°</label><div class="pips">${Array.from({length: num(s.total)}, (_, k) =>
          `<button class="pip${k < num(s.used) ? ' used' : ''}" data-act="slot" data-n="${n}" data-k="${k + 1}" aria-label="Slot di ${n}° livello ${k + 1}${k < num(s.used) ? ', usato' : ''}"></button>`).join('')}</div>
          <small>${num(s.total) - num(s.used)}/${num(s.total)}</small></div>`).join('')}</div>` : ''}
      ${shown.length ? Object.keys(groups).map(L => `
        <div class="s-spgroup"><div class="s-splvl">${L == 0 ? 'Trucchetti' : L + '° livello'}</div>
        ${groups[L].map(({sp, i}) => `<div class="s-spell">
          <button class="s-spname" data-act="spinfo" data-i="${i}">${esc(sp.name)}${concentrationSpell(sp) ? ' <small title="Concentrazione">C</small>' : ''}</button>
          ${L > 0 ? `<button class="btn small" data-act="cast" data-i="${i}" title="Usa uno slot e lancia">Lancia</button>` : ''}
        </div>`).join('')}</div>`).join('') + (prepared.length ? '' : '<div class="small-note">Nessun incantesimo segnato come preparato: li vedi tutti.</div>')
      : '<div class="small-note">Aggiungi incantesimi nella scheda.</div>'}
    </section>`;
  }

  function companionsHtml(){
    if(!window.Companions) return '';
    Companions.ensure();
    return `<section class="s-card"><h4>Compagni</h4>${CHAR.companions.length ? CHAR.companions.map(Companions.cardHtml).join('')
      : '<div class="small-note">Nessun compagno. Aggiungilo nella scheda («Compagni»).</div>'}</section>`;
  }

  /* ================= render ================= */
  const root = document.createElement('div');
  root.id = 'sessionView'; root.className = 'session-view'; root.hidden = true;
  const layoutBar = document.querySelector('#view-sheet .layout-bar');
  layoutBar.insertAdjacentElement('afterend', root);

  function render(){
    if(root.hidden) return;
    ensure();
    const cls = CHAR.meta.classes.filter(c => c.name).map(c => `${c.name}${c.subclass ? ' (' + c.subclass + ')' : ''} ${num(c.level)}`).join(' / ');
    const race = CHAR.meta.raceCustom || CHAR.meta.raceSel || '';
    root.innerHTML = `
      <div class="s-top">
        <div class="s-who"><b>${esc(CHAR.meta.name || 'Personaggio senza nome')}</b><span>Liv. ${totalLevel()}${cls ? ' · ' + esc(cls) : ''}${race ? ' · ' + esc(race) : ''}</span></div>
        <div class="s-rest">
          <button class="btn small" data-act="short">☀ Riposo breve</button>
          <button class="btn small" data-act="long">☾ Riposo lungo</button>
        </div>
      </div>
      <div class="s-grid">
        <div class="s-col">
          ${vitalsHtml()}
          ${statsHtml()}
          <section class="s-card">${concHtml()}${hitDiceHtml()}</section>
          <section class="s-card"><h4>Condizioni</h4>${conditionsHtml()}</section>
          ${companionsHtml()}
        </div>
        <div class="s-col">
          <section class="s-card"><h4>Azioni</h4>${attacksHtml()}</section>
          ${resourcesHtml()}
          ${consumablesHtml()}
          ${featuresHtml()}
        </div>
        <div class="s-col">
          ${abilitiesHtml()}
          ${spellsHtml()}
          ${skillsHtml()}
        </div>
      </div>`;
  }

  /* ================= eventi ================= */
  const atkCrit = {};
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(!b || b.tagName === 'SELECT') return;
    const a = b.dataset.act, c = CHAR.combat;
    switch(a){
      case 'hp': { const v = num(b.dataset.v); v < 0 ? damage(-v) : heal(v); break; }
      case 'ds': {
        const i = num(b.dataset.i), key = b.dataset.kind === 'ok' ? 'deathSuccess' : 'deathFail';
        c[key] = num(c[key]) === i ? i - 1 : i; commit(); break;
      }
      case 'deathroll': {
        const r = Dice.d20(0, 'TS contro la morte');
        if(r.nat === 20){ c.hpCur = 1; c.deathSuccess = 0; c.deathFail = 0; toast('20 naturale: torni a 1 PF!'); }
        else if(r.nat === 1) c.deathFail = Math.min(3, num(c.deathFail) + 2);
        else if(r.total >= 10) c.deathSuccess = Math.min(3, num(c.deathSuccess) + 1);
        else c.deathFail = Math.min(3, num(c.deathFail) + 1);
        if(num(c.deathSuccess) >= 3) toast('3 successi: sei stabile');
        if(num(c.deathFail) >= 3) toast('3 fallimenti…');
        commit(); break;
      }
      case 'init': Dice.d20(initBonus(), 'Iniziativa'); break;
      case 'insp': CHAR.meta.inspiration = !CHAR.meta.inspiration; commit(); break;
      case 'check': Dice.d20(abMod(b.dataset.ab), `Prova di ${ABILITY_LABELS[b.dataset.ab]}`); break;
      case 'save': Dice.d20(saveBonus(b.dataset.ab), `TS ${ABILITY_LABELS[b.dataset.ab]}`); break;
      case 'skill': Dice.d20(skillBonus(b.dataset.key, b.dataset.ab), SKILL_LABELS[b.dataset.key]); break;
      case 'atk': {
        const at = CHAR.attacks[num(b.dataset.i)]; const m = String(at.bonus).replace(/[−–]/g, '-').match(/[+-]?\s*\d+/);
        const r = Dice.d20(m ? Number(m[0].replace(/\s/g, '')) : 0, `${at.name || 'Attacco'} (colpire)`);
        atkCrit[b.dataset.i] = r.crit; break;
      }
      case 'dmg': {
        const at = CHAR.attacks[num(b.dataset.i)];
        Dice.expr(at.damage, `${at.name || 'Attacco'} (danni)`, {crit: atkCrit[b.dataset.i], min: 0}); atkCrit[b.dataset.i] = false; break;
      }
      case 'spellatk': { const ss = spellStats(); if(ss) Dice.d20(ss.atk, 'Attacco con incantesimo'); break; }
      case 'conc': {
        if(c.concentration){ c.concentration = ''; concPrompt = null; }
        else { const n = prompt('Su quale incantesimo ti concentri? (puoi lasciare vuoto)', ''); if(n === null) break; c.concentration = n.trim() || 'Concentrazione'; }
        commit(); break;
      }
      case 'concsave': {
        const r = Dice.d20(saveBonus('con'), 'TS Costituzione (concentrazione)', {dc: concPrompt.dc});
        if(r.total < concPrompt.dc){ toast('Concentrazione persa'); c.concentration = ''; }
        concPrompt = null; commit(); break;
      }
      case 'concdismiss': concPrompt = null; render(); break;
      case 'hd': {
        const h = hitDice(); if(!h.left) break;
        const r = Dice.expr(`1d${h.die}${abMod('con') >= 0 ? '+' : ''}${abMod('con')}`, 'Dado vita', {min: 0});
        c.hitDiceUsed = num(c.hitDiceUsed) + 1; if(r) heal(Math.max(0, r.total)); else commit(); break;
      }
      case 'condinfo': {
        const x = CHAR.conditions.find(k => k.id === b.closest('[data-cond]').dataset.cond);
        if(x && x.dbId && findEntry('conditions', x.dbId)) showEntryModal('conditions', x.dbId); break;
      }
      case 'condrm': CHAR.conditions = CHAR.conditions.filter(k => k.id !== b.closest('[data-cond]').dataset.cond); commit(); renderBuildConditions(); break;
      case 'exh': {
        const x = CHAR.conditions.find(k => k.id === b.closest('[data-cond]').dataset.cond); if(!x) break;
        x.level = Math.max(0, Math.min(6, (num(x.level) || 1) + num(b.dataset.v)));
        if(x.level === 0) CHAR.conditions = CHAR.conditions.filter(k => k !== x);
        if(x.level === 6) toast('Esaustione 6: il personaggio muore');
        commit(); renderBuildConditions(); break;
      }
      case 'res': case 'resstep': {
        const r = (CHAR.resources || []).find(x => x.id === b.dataset.id); if(!r) break;
        if(a === 'res'){ const k = num(b.dataset.k); r.cur = num(r.cur) === k ? k - 1 : k; }
        else r.cur = Math.max(0, Math.min(num(r.max), num(r.cur) + num(b.dataset.v)));
        commit(); break;
      }
      case 'consuse': {
        const it = CHAR.consumables.find(x => x.id === b.dataset.id); if(!it || num(it.qty) <= 0) break;
        it.qty = num(it.qty) - 1; toast(it.qty ? `${it.name}: ne restano ${it.qty}` : `${it.name} esaurito`); commit(); break;
      }
      case 'consroll': { const it = CHAR.consumables.find(x => x.id === b.dataset.id); if(it) Dice.expr(it.notes, it.name); break; }
      case 'slot': {
        const s = CHAR.spellcasting.slots[b.dataset.n], k = num(b.dataset.k);
        s.used = num(s.used) === k ? k - 1 : k; commit(); break;
      }
      case 'spinfo': {
        const sp = CHAR.spellcasting.spells[num(b.dataset.i)]; if(!sp) break;
        if(sp.dbId) showEntryModal('spells', sp.dbId); else if(sp.custom) openSpellModal(num(b.dataset.i)); break;
      }
      case 'cast': {
        const sp = CHAR.spellcasting.spells[num(b.dataset.i)]; if(!sp) break;
        const L = spellLevelNum(sp.level);
        let n = null;
        for(let k = L; k <= 9; k++){ const s = CHAR.spellcasting.slots[k]; if(num(s.total) - num(s.used) > 0){ n = k; break; } }
        if(n === null){ toast(`Nessuno slot libero di ${L}° livello o superiore`); break; }
        CHAR.spellcasting.slots[n].used = num(CHAR.spellcasting.slots[n].used) + 1;
        let msg = `${sp.name}: usato uno slot di ${n}° livello`;
        if(concentrationSpell(sp)){
          if(c.concentration && c.concentration !== sp.name) msg += ` · smetti di concentrarti su ${c.concentration}`;
          c.concentration = sp.name; concPrompt = null;
        }
        toast(msg); commit(); break;
      }
      case 'short': $('btnShortRest').click(); break;
      case 'long': $('btnLongRest').click(); break;
    }
  });
  root.addEventListener('change', e => {
    if(e.target.dataset.act !== 'condadd' || !e.target.value) return;
    addCondition(e.target.value);
  });
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-form="hp"]'); if(!f) return;
    e.preventDefault();
    const v = num(f.elements.v.value), act = e.submitter ? e.submitter.value : 'dmg';
    if(!v && act !== 'temp'){ f.elements.v.focus(); return; }
    if(act === 'heal') heal(v); else if(act === 'temp') setTemp(v); else damage(v);
  });

  function addCondition(dbId){
    const e = findEntry('conditions', dbId); if(!e) return;
    CHAR.conditions.push({id: uid(), name: e.name, dbId, level: /esaust|exhaust/i.test(e.name) ? 1 : undefined});
    markSaving(); render(); renderBuildConditions();
  }

  /* condizioni e concentrazione anche nella scheda, nel pannello Combattimento */
  const buildBox = document.createElement('div');
  buildBox.className = 'build-conds'; buildBox.id = 'buildConditions';
  const ds = document.querySelector('#view-sheet .panel[data-sec="combat"] .death-saves');
  if(ds) ds.insertAdjacentElement('afterend', buildBox);
  function renderBuildConditions(){
    ensure();
    buildBox.innerHTML = `<label>Condizioni</label>${conditionsHtml()}${concHtml()}`;
  }
  buildBox.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(!b || b.tagName === 'SELECT') return;
    if(['condinfo', 'condrm', 'exh', 'conc', 'concsave', 'concdismiss'].includes(b.dataset.act)){
      handleShared(b);   // stessa logica della Sessione
    }
  });
  buildBox.addEventListener('change', e => { if(e.target.dataset.act === 'condadd' && e.target.value) addCondition(e.target.value); });
  function handleShared(b){
    // inoltra il clic al gestore della Sessione con un pulsante "fantasma" dentro root
    const ghost = document.createElement('button');
    Object.assign(ghost.dataset, b.dataset);
    const holder = b.closest('[data-cond]');
    let wrap = ghost;
    if(holder){ wrap = document.createElement('span'); wrap.dataset.cond = holder.dataset.cond; wrap.appendChild(ghost); }
    wrap.style.display = 'none'; root.appendChild(wrap); ghost.click(); wrap.remove();
    renderBuildConditions();
  }

  /* ================= riposi: estensioni ================= */
  const origRecharge = rechargeConsumables;
  rechargeConsumables = function(kinds){
    const n = origRecharge(kinds);
    if(kinds.includes('long')){
      CHAR.combat.hitDiceUsed = 0;                       // 2024: il riposo lungo restituisce tutti i dadi vita
      CHAR.combat.concentration = ''; concPrompt = null;
      const ex = CHAR.conditions.find(x => /esaust|exhaust/i.test(x.name));
      if(ex){ ex.level = (num(ex.level) || 1) - 1; if(ex.level <= 0) CHAR.conditions = CHAR.conditions.filter(x => x !== ex); }
    }
    setTimeout(() => { render(); renderBuildConditions(); }, 0);
    return n;
  };

  /* ================= interruttore Scheda / Sessione ================= */
  const sw = document.createElement('div');
  sw.className = 'mode-switch'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Modalità della scheda');
  sw.innerHTML = `<button data-mode="build">✎ Scheda</button><button data-mode="session">⚔ Sessione</button>`;
  layoutBar.prepend(sw);

  // tornando alla scheda: ridisegna i campi che la Sessione può aver cambiato
  function refreshBuild(){
    initSheetStaticBindings();
    renderDeathSaves(); renderSlots(); renderConsumables(); renderComputed();
    if(window.renderResourcesEditor) renderResourcesEditor();
    if(window.Companions) Companions.renderBuild();
    renderBuildConditions();
  }
  function setMode(m, quiet){
    const session = m === 'session';
    document.body.classList.toggle('mode-session', session);
    root.hidden = !session;
    sw.querySelectorAll('button').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    try{ localStorage.setItem(MODE_KEY, m); }catch(err){}
    if(session){
      if(document.body.classList.contains('layout-editing')) $('btnLayout').click();
      render();
    } else if(!quiet) refreshBuild();
    if(!quiet) window.scrollTo({top: 0});
  }
  sw.addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if(b) setMode(b.dataset.mode); });

  const origRenderAll = renderAll;
  renderAll = function(){ origRenderAll(); ensure(); renderBuildConditions(); render(); };

  let saved = 'build';
  try{ saved = localStorage.getItem(MODE_KEY) || 'build'; }catch(err){}
  renderBuildConditions();
  setMode(saved === 'session' ? 'session' : 'build', true);

  window.Session = {refresh: render, setMode};
})();
