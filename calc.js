/* =========================================================
   CALC FIELDS — addizioni e sottrazioni nei campi numerici
   ---------------------------------------------------------
   In ogni <input type="number"> si può scrivere:
     "+15"      → aggiunge 15 al valore attuale
     "-3"       → sottrae 3 dal valore attuale
     "10+5-2"   → imposta il risultato (13)
   Il calcolo viene applicato con Invio o uscendo dal campo; Esc annulla.
   Durante la modifica il campo diventa di testo (i number input non
   accettano "+" o espressioni), poi torna numerico.
   ========================================================= */
(function(){
  const PLAIN = /^-?\d+([.,]\d+)?$/;
  const HINT = 'Scrivi +N o −N per sommare/sottrarre (es. +15, -3, 10+5). Invio per confermare, Esc per annullare';
  let committing = false;

  function isCalc(el){ return el && el.dataset && el.dataset.calc === '1'; }
  function eligible(el){
    return el && el.tagName === 'INPUT' && el.type === 'number' && !el.readOnly && !el.disabled && !el.hasAttribute('data-nocalc');
  }

  // Valuta somme/sottrazioni; restituisce null se l'espressione non è valida
  function evaluate(expr, base){
    let s = expr.replace(/\s+/g, '').replace(/,/g, '.').replace(/[−–]/g, '-');
    if(s === '') return '';
    if(s.startsWith('=')) s = s.slice(1);
    // un segno iniziale (anche "-3" da solo) somma/sottrae dal valore attuale
    const relative = /^[+-]/.test(s);
    if(!/^[+-]?\d+(\.\d+)?([+-]\d+(\.\d+)?)*$/.test(s)) return null;
    const terms = s.match(/[+-]?\d+(\.\d+)?/g);
    let total = terms.reduce((a, t) => a + Number(t), 0);
    if(relative) total += base;
    return Math.round(total * 1000) / 1000;
  }

  function clamp(el, v){
    const min = el.getAttribute('min'), max = el.getAttribute('max');
    if(min !== null && min !== '' && v < Number(min)) v = Number(min);
    if(max !== null && max !== '' && v > Number(max)) v = Number(max);
    return v;
  }

  function enter(el){
    el.dataset.calc = '1';
    el.dataset.calcOrig = el.value;
    if(!el.title) { el.title = HINT; el.dataset.calcTitle = '1'; }
    el.type = 'text';
    el.setAttribute('autocomplete', 'off');
    el.classList.add('calc-active');
  }

  function leave(el){
    el.type = 'number';
    el.classList.remove('calc-active', 'calc-bad');
    delete el.dataset.calc;
    delete el.dataset.calcOrig;
    if(el.dataset.calcTitle){ el.removeAttribute('title'); delete el.dataset.calcTitle; }
  }

  // Applica il risultato e notifica i listener dell'app con eventi "veri"
  function commit(el, keepEditing, absolute){
    const orig = el.dataset.calcOrig ?? '';
    const base = Number(String(orig).replace(',', '.')) || 0;
    const res = absolute !== undefined ? absolute : evaluate(el.value, base);
    let next = res === null ? orig : (res === '' ? '' : String(clamp(el, res)));
    const changed = next !== orig;
    leave(el);
    el.value = next;
    if(changed){
      committing = true;
      try{
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } finally { committing = false; }
    }
    // l'app può aver ri-renderizzato il campo: continua solo se è ancora lì
    if(keepEditing && el.isConnected && document.activeElement === el){
      enter(el);
      el.select();
    }
  }

  document.addEventListener('focusin', e => {
    const el = e.target;
    if(eligible(el) && !isCalc(el)) enter(el);
  }, true);

  document.addEventListener('focusout', e => {
    if(isCalc(e.target)) commit(e.target, false);
  }, true);

  // Mentre si scrive l'espressione, i listener dell'app non devono vedere valori parziali
  ['input', 'change'].forEach(type => {
    window.addEventListener(type, e => {
      const el = e.target;
      if(committing || !isCalc(el)) return;
      e.stopImmediatePropagation();
      if(type === 'input'){
        const ok = el.value.trim() === '' || evaluate(el.value, 0) !== null;
        el.classList.toggle('calc-bad', !ok);
      }
    }, true);
  });

  document.addEventListener('keydown', e => {
    const el = e.target;
    if(!isCalc(el)) return;
    if(e.key === 'Enter'){
      e.preventDefault();
      commit(el, true);
    } else if(e.key === 'Escape'){
      e.preventDefault();
      el.value = el.dataset.calcOrig ?? '';
      el.classList.remove('calc-bad');
    } else if((e.key === 'ArrowUp' || e.key === 'ArrowDown') && PLAIN.test(el.value.trim() || '0')){
      // ripristina le frecce su/giù dei campi numerici
      e.preventDefault();
      const step = Number(el.getAttribute('step')) || 1;
      const cur = Number(el.value.replace(',', '.')) || 0;
      commit(el, true, cur + (e.key === 'ArrowUp' ? step : -step));
    }
  }, true);
})();
