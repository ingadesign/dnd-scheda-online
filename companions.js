/* =========================================================
   COMPAGNI — famigli, compagni animali, cavalcature,
   evocazioni, forma selvatica…
   ---------------------------------------------------------
   Pannello «Compagni» nella scheda (modifica) e schede compatte
   nella modalità Sessione (PF, attacchi tirabili).
   Dati: CHAR.companions = [{id, name, type, creature, ac, hpMax,
   hpCur, speed, attacks, abilities, notes, open}]
   Gli attacchi si scrivono uno per riga, es.
     "Artigli: +3 per colpire, 1d4+1 taglienti"
   ========================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => escapeHtml(String(s ?? ''));
  const num = v => Number(v) || 0;

  const TYPES = ['Famiglio', 'Compagno animale', 'Cavalcatura', 'Evocazione', 'Forma selvatica', 'Altro'];
  // statistiche SRD 5.2 (velocità in metri, come il resto della scheda)
  const PRESETS = [
    {creature:'Gufo', type:'Famiglio', ac:11, hp:1, speed:'1,5 m, volo 18 m', attacks:'Artigli: +3 per colpire, 1 taglienti', abilities:'Volo radente: non provoca attacchi di opportunità quando vola fuori dalla portata. Vista e udito acuti. Scurovisione 36 m.'},
    {creature:'Falco', type:'Famiglio', ac:13, hp:1, speed:'3 m, volo 18 m', attacks:'Artigli: +5 per colpire, 1 taglienti', abilities:'Vista acuta.'},
    {creature:'Gatto', type:'Famiglio', ac:12, hp:2, speed:'12 m, scalare 12 m', attacks:'Graffio: +4 per colpire, 1 taglienti', abilities:'Salto: salta fino a 3 m in lungo o in alto. Olfatto acuto.'},
    {creature:'Corvo', type:'Famiglio', ac:12, hp:2, speed:'3 m, volo 15 m', attacks:'Becco: +4 per colpire, 1 perforanti', abilities:'Mimetismo: imita suoni semplici e voci che ha sentito.'},
    {creature:'Pipistrello', type:'Famiglio', ac:12, hp:1, speed:'1,5 m, volo 9 m', attacks:'Morso: +4 per colpire, 1 perforanti', abilities:'Vista cieca 18 m. Ecolocazione: non usa la vista cieca se è assordato.'},
    {creature:'Lupo', type:'Compagno animale', ac:12, hp:11, speed:'12 m', attacks:'Morso: +4 per colpire, 1d6+2 perforanti', abilities:'Tattiche del branco: vantaggio se un alleato è entro 1,5 m dal bersaglio. Un bersaglio Grande o più piccolo colpito cade Prono.'},
    {creature:'Cavallo da galoppo', type:'Cavalcatura', ac:11, hp:13, speed:'18 m', attacks:'Zoccoli: +4 per colpire, 1d8+2 contundenti', abilities:''},
    {creature:'Cavallo da guerra', type:'Cavalcatura', ac:11, hp:19, speed:'18 m', attacks:'Zoccoli: +6 per colpire, 2d4+4 contundenti', abilities:'Carica: se si muove di 6 m in linea retta e colpisce, il bersaglio fa TS Forza CD 14 o cade Prono.'}
  ];

  function ensure(){
    if(!Array.isArray(CHAR.companions)) CHAR.companions = [];
    CHAR.companions.forEach(c => { if(!c.id) c.id = uid(); if(c.hpCur === undefined) c.hpCur = c.hpMax; });
  }
  ensure();
  const find = id => CHAR.companions.find(c => c.id === id);

  /* "Morso: +4 per colpire, 1d6+2 perforanti" → {label, hit:4, dmg:'1d6+2', dmgText} */
  function parseAttack(line){
    const raw = String(line).trim(); if(!raw) return null;
    const ci = raw.indexOf(':');
    const label = ci > 0 ? raw.slice(0, ci).trim() : 'Attacco';
    const rest = ci > 0 ? raw.slice(ci + 1) : raw;
    const hitM = rest.match(/(?:^|[\s(,])([+-]\s?\d+)(?=\s*(?:per colpire|al colpire|a colpire|to hit|\)|,|$))/i);
    const afterHit = hitM ? rest.slice(rest.indexOf(hitM[0]) + hitM[0].length) : rest;
    const dmgM = afterHit.match(/\d*d\d+(\s*[+-]\s*\d+)?/i) || afterHit.match(/,\s*(\d+)\s+\p{L}/u);
    return {label, raw, hit: hitM ? Number(hitM[1].replace(/\s/g, '')) : null,
            dmg: dmgM ? (dmgM[0].includes('d') ? dmgM[0] : dmgM[1]) : null};
  }

  function hpHtml(c){
    const mx = num(c.hpMax), cu = Math.max(0, num(c.hpCur));
    const pct = mx ? Math.min(100, cu / mx * 100) : 0;
    return `<div class="comp-hp">
      <span class="comp-hp-lbl">PF</span>
      <button class="mini-btn" data-comp-hp="-1" aria-label="Togli 1 PF a ${esc(c.name || c.creature)}">−</button>
      <b>${cu}<small>/${mx}</small></b>
      <button class="mini-btn" data-comp-hp="1" aria-label="Aggiungi 1 PF a ${esc(c.name || c.creature)}">+</button>
      <div class="comp-hp-bar"><span class="${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}" style="width:${pct}%"></span></div>
    </div>`;
  }
  function attacksHtml(c){
    return String(c.attacks || '').split('\n').map(parseAttack).filter(Boolean).map((a, i) => `
      <div class="comp-atk">
        <span>${esc(a.label)}</span>
        ${a.hit !== null ? `<button class="roll-btn" data-comp-roll="hit" data-i="${i}" title="Tiro per colpire">${a.hit >= 0 ? '+' : ''}${a.hit}</button>` : ''}
        ${a.dmg ? `<button class="roll-btn dmg" data-comp-roll="dmg" data-i="${i}" title="Tiro dei danni">${esc(a.dmg)}</button>` : ''}
      </div>`).join('');
  }

  /* scheda compatta (usata in Sessione e come intestazione in modifica) */
  function cardHtml(c){
    const title = c.name ? `${esc(c.name)} <small>— ${esc(c.creature || c.type)}</small>` : esc(c.creature || 'Compagno');
    return `<div class="comp-card${num(c.hpCur) <= 0 && num(c.hpMax) > 0 ? ' down' : ''}" data-comp="${c.id}">
      <div class="comp-head"><span class="comp-ico" aria-hidden="true">🐾</span><div class="comp-title">${title}<div class="comp-sub">${esc(c.type || '')} · CA ${num(c.ac)}${c.speed ? ' · ' + esc(c.speed) : ''}</div></div></div>
      ${hpHtml(c)}
      ${attacksHtml(c)}
      ${c.abilities ? `<div class="comp-abil">${esc(c.abilities)}</div>` : ''}
    </div>`;
  }

  /* ---------------- pannello nella scheda ---------------- */
  function renderBuild(){
    ensure();
    const wrap = $('companionsList'); if(!wrap) return;
    wrap.innerHTML = CHAR.companions.length ? CHAR.companions.map(c => `
      <div class="comp-edit${c.open ? ' open' : ''}" data-comp="${c.id}">
        ${cardHtml(c)}
        <div class="comp-edit-tools">
          <button class="btn small" data-comp-toggle aria-expanded="${!!c.open}">${c.open ? 'Chiudi' : 'Modifica'}</button>
          <button class="icon-btn" data-comp-del title="Rimuovi" aria-label="Rimuovi ${esc(c.name || c.creature)}">✕</button>
        </div>
        ${c.open ? `<div class="comp-form">
          <div class="grid g-2">
            <div class="field"><label>Nome</label><input type="text" data-cf="name" value="${esc(c.name)}" placeholder="es. Pepe"></div>
            <div class="field"><label>Tipo</label><select data-cf="type">${TYPES.map(t => `<option${t === c.type ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
          </div>
          <div class="grid g-4">
            <div class="field" style="grid-column:span 2;"><label>Creatura</label><input type="text" data-cf="creature" value="${esc(c.creature)}" placeholder="es. Gufo, Elementale"></div>
            <div class="field"><label>CA</label><input type="number" data-cf="ac" value="${num(c.ac)}"></div>
            <div class="field"><label>PF max</label><input type="number" data-cf="hpMax" value="${num(c.hpMax)}"></div>
          </div>
          <div class="field"><label>Velocità</label><input type="text" data-cf="speed" value="${esc(c.speed)}" placeholder="9 m, volo 18 m"></div>
          <div class="field"><label>Attacchi (uno per riga)</label><textarea data-cf="attacks" rows="2" placeholder="Morso: +4 per colpire, 1d6+2 perforanti">${esc(c.attacks)}</textarea></div>
          <div class="field"><label>Capacità</label><textarea data-cf="abilities" rows="2">${esc(c.abilities)}</textarea></div>
          <div class="field"><label>Note</label><textarea data-cf="notes" rows="2">${esc(c.notes)}</textarea></div>
        </div>` : ''}
      </div>`).join('') : '<div class="empty-hint">Nessun compagno. Aggiungine uno o scegli una creatura qui sotto.</div>';
    const qa = $('companionsQuick');
    if(qa && !qa.dataset.ready){
      qa.innerHTML = '<span class="small-note">Aggiunta rapida:</span>' + PRESETS.map((p, i) => `<button class="chip" data-comp-preset="${i}">${esc(p.creature)}</button>`).join('');
      qa.dataset.ready = '1';
    }
  }

  function add(preset){
    const p = preset || {};
    const c = {id: uid(), name: '', type: p.type || 'Famiglio', creature: p.creature || '', ac: p.ac ?? 10, hpMax: p.hp ?? 1, hpCur: p.hp ?? 1,
      speed: p.speed || '', attacks: p.attacks || '', abilities: p.abilities || '', notes: '', open: !preset};
    CHAR.companions.push(c); markSaving(); refreshAll();
    toast(preset ? `${p.creature} aggiunto ai compagni` : 'Nuovo compagno: compila la scheda');
  }
  function refreshAll(){ renderBuild(); if(window.Session) Session.refresh(); }

  /* ---------------- eventi (delegati: valgono in scheda e in Sessione) ---------------- */
  document.addEventListener('click', e => {
    const pr = e.target.closest('[data-comp-preset]'); if(pr){ add(PRESETS[num(pr.dataset.compPreset)]); return; }
    if(e.target.closest('#btnAddCompanion')){ add(null); return; }
    const host = e.target.closest('[data-comp]'); if(!host) return;
    const c = find(host.dataset.comp); if(!c) return;
    const hp = e.target.closest('[data-comp-hp]');
    if(hp){
      c.hpCur = Math.max(0, Math.min(num(c.hpMax) || Infinity, num(c.hpCur) + num(hp.dataset.compHp)));
      markSaving(); refreshAll(); return;
    }
    const roll = e.target.closest('[data-comp-roll]');
    if(roll){
      const a = String(c.attacks || '').split('\n').map(parseAttack).filter(Boolean)[num(roll.dataset.i)]; if(!a) return;
      const who = c.name || c.creature || 'Compagno';
      if(roll.dataset.compRoll === 'hit'){ const r = Dice.d20(a.hit, `${who} · ${a.label} (colpire)`); c._crit = r.crit; }
      else if(/d/i.test(a.dmg)){ Dice.expr(a.dmg, `${who} · ${a.label} (danni)`, {crit: c._crit, min: 0}); c._crit = false; }
      else toast(`${who} · ${a.label}: ${a.dmg} danni`);
      return;
    }
    if(e.target.closest('[data-comp-toggle]')){ c.open = !c.open; markSaving(); renderBuild(); return; }
    if(e.target.closest('[data-comp-del]')){
      if(!confirm(`Rimuovere «${c.name || c.creature || 'compagno'}»?`)) return;
      CHAR.companions = CHAR.companions.filter(x => x !== c); markSaving(); refreshAll();
    }
  });
  document.addEventListener('input', e => {
    const f = e.target.dataset.cf; if(!f) return;
    const c = find(e.target.closest('[data-comp]').dataset.comp); if(!c) return;
    if(['ac', 'hpMax'].includes(f)){
      const v = Math.max(0, num(e.target.value));
      if(f === 'hpMax' && (num(c.hpCur) >= num(c.hpMax) || num(c.hpCur) > v)) c.hpCur = v;   // se era pieno resta pieno
      c[f] = v;
    } else c[f] = e.target.value;
    markSaving();
  });
  // aggiorna l'anteprima quando si esce da un campo (senza perdere il cursore mentre si scrive)
  document.addEventListener('change', e => {
    if(!e.target.dataset.cf) return;
    const host = e.target.closest('.comp-edit'); const c = host && find(host.dataset.comp); if(!c) return;
    const card = host.querySelector('.comp-card'); if(card) card.outerHTML = cardHtml(c);
    if(window.Session) Session.refresh();
  });

  const origRenderAll = renderAll;
  renderAll = function(){ origRenderAll(); ensure(); renderBuild(); };
  renderBuild();
  window.Companions = {cardHtml, renderBuild, ensure};
})();
