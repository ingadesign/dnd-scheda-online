const CATS = [
  {key:'weapons', label:'Armi'},
  {key:'armor', label:'Armature'},
  {key:'weapon_properties', label:'Proprietà Armi'},
  {key:'armor_properties', label:'Proprietà Armature'},
  {key:'mastery_properties', label:'Mastery'},
  {key:'ammunition', label:'Munizioni'},
  {key:'tools', label:'Strumenti'},
  {key:'gear', label:'Equipaggiamento'},
  {key:'conditions', label:'Condizioni'},
  {key:'critical_scars', label:'Cicatrici Critiche'},
  {key:'feats', label:'Talenti'},
  {key:'potions', label:'Pozioni'},
  {key:'poisons', label:'Veleni'},
  {key:'races', label:'Razze'},
  {key:'classes', label:'Classi'},
  {key:'statblocks', label:'Creature'},
  {key:'spells', label:'Incantesimi'},
  {key:'misc', label:'Varie'},
];
const CAT_LABEL = Object.fromEntries(CATS.map(c=>[c.key,c.label]));

const SKILLS = [
  ['acrobazia','dex'],['addestrare_animali','wis'],['arcano','int'],['atletica','str'],
  ['furtivita','dex'],['indagare','int'],['inganno','cha'],['intimidire','cha'],
  ['intrattenere','cha'],['intuizione','wis'],['medicina','wis'],['natura','int'],
  ['percezione','wis'],['persuasione','cha'],['rapidita_di_mano','dex'],['religione','int'],
  ['sopravvivenza','wis'],['storia','int'],
];
const SKILL_LABELS = {
  acrobazia:'Acrobazia', addestrare_animali:'Addestrare Animali', arcano:'Arcano', atletica:'Atletica',
  furtivita:'Furtività', indagare:'Indagare', inganno:'Inganno', intimidire:'Intimidire',
  intrattenere:'Intrattenere', intuizione:'Intuizione', medicina:'Medicina', natura:'Natura',
  percezione:'Percezione', persuasione:'Persuasione', rapidita_di_mano:'Rapidità di Mano',
  religione:'Religione', sopravvivenza:'Sopravvivenza', storia:'Storia',
};
const ABILITY_LABELS = {str:'Forza', dex:'Destrezza', con:'Costituzione', int:'Intelligenza', wis:'Saggezza', cha:'Carisma'};

const SPELL_SCHOOLS = ['Abiurazione','Ammaliamento','Divinazione','Evocazione','Illusione','Invocazione','Necromanzia','Trasmutazione'];
const SPELL_LEVEL_LABELS = {0:'Trucchetto',1:'1° Livello',2:'2° Livello',3:'3° Livello',4:'4° Livello',5:'5° Livello',6:'6° Livello',7:'7° Livello',8:'8° Livello',9:'9° Livello'};

// Where a Trait/Feature comes from, so it's immediately clear at a glance.
const FEATURE_SOURCES = ['Altro','Background','Classe','Razza','Sottoclasse','Talento'];
// Auto-guessed source when a feature is added from the Database picker, based on its DB category.
const CAT_TO_SOURCE = {races:'Razza', classes:'Classe', feats:'Talento'};

/* ---------------- Recap sessioni ----------------
   Link predefinito ai recap del master (cartella Drive del vault Obsidian,
   Obsidian Publish, ecc.). Se lo compili qui, tutti i giocatori che aprono
   il sito lo trovano già impostato; ognuno può comunque cambiarlo da
   "⋯ Dati → Imposta link recap". */
const RECAP_URL_DEFAULT = '';
const RECAP_KEY = 'epsilon_recap_url';

const CONSUMABLE_CATS = ['Pozione','Munizioni','Veleno','Pergamena','Cibo & Acqua','Scrap','Attrezzatura','Uso di abilità','Altro'];
const RECHARGE_LABELS = {'':'Nessuna ricarica', short:'Riposo breve', long:'Riposo lungo'};

/* ---------------- storage ---------------- */
const SHEET_KEY = 'epsilon_dnd_sheet_v1';
const CUSTOM_KEY = 'epsilon_dnd_custom_rules_v1';

function defaultChar(){
  return {
    meta:{name:'',player:'',classes:[{name:'',subclass:'',level:1}],xp:0,background:'',raceSel:'',raceCustom:'',alignment:'',size:'Media',speed:9,empathy:0,inspiration:false},
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
    saveProf:{str:false,dex:false,con:false,int:false,wis:false,cha:false},
    skills: Object.fromEntries(SKILLS.map(([k])=>[k,{prof:false,exp:false}])),
    combat:{ac:10,hpMax:0,hpCur:0,hpTemp:0,hitDice:'',deathSuccess:0,deathFail:0,initiative:'',passivePerception:''},
    currency:{mp:0,mo:0,me:0,ma:0,mr:0},
    attacks:[],
    inventory:[],
    spellcasting:{class:'',ability:'',slots:Object.fromEntries([1,2,3,4,5,6,7,8,9].map(n=>[n,{total:0,used:0}])),spells:[]},
    features:[],
    personality:{traits:'',ideals:'',bonds:'',flaws:''},
    proficiencies:'',
    notes:'',
    consumables:[],
    notesList:[]
  };
}

// Upgrades characters saved by older versions of the sheet (single class/level,
// auto-computed initiative & passive perception) to the current schema.
function migrateChar(c){
  if(!Array.isArray(c.meta.classes) || c.meta.classes.length===0){
    const name = c.meta.classSel || c.meta.classCustom || '';
    c.meta.classes = [{name, subclass:c.meta.subclass||'', level:c.meta.level||1}];
  }
  delete c.meta.classSel; delete c.meta.classCustom; delete c.meta.subclass; delete c.meta.level;
  if(c.combat.initiative===undefined) c.combat.initiative='';
  if(c.combat.passivePerception===undefined) c.combat.passivePerception='';
  if(c.meta.empathy===undefined || c.meta.empathy===null || c.meta.empathy===''){
    c.meta.empathy = 0;
  } else {
    c.meta.empathy = Math.min(300, Math.max(0, Number(c.meta.empathy)||0));
  }
  (c.features||[]).forEach(f=>{ if(f.expanded===undefined) f.expanded=false; if(f.source===undefined) f.source=''; });
  (c.inventory||[]).forEach(it=>{ if(it.expanded===undefined) it.expanded=false; if(it.where===undefined) it.where=''; if(it.attune===undefined) it.attune=''; });
  if(!c.currency) c.currency={mp:0,mo:0,me:0,ma:0,mr:0};
  // salvataggi incompleti: abilità e tiri salvezza mancanti
  c.skills = Object.assign(Object.fromEntries(SKILLS.map(([k])=>[k,{prof:false,exp:false}])), c.skills||{});
  c.saveProf = Object.assign({str:false,dex:false,con:false,int:false,wis:false,cha:false}, c.saveProf||{});
  c.personality = Object.assign({traits:'',ideals:'',bonds:'',flaws:''}, c.personality||{});
  if(c.currency.me===undefined) c.currency.me=0;
  if(!Array.isArray(c.consumables)) c.consumables=[];
  if(!Array.isArray(c.notesList)) c.notesList=[];
  c.consumables.forEach(it=>{ if(!it.id) it.id=uid(); if(it.qty===undefined) it.qty=1; if(it.max===undefined) it.max=''; if(it.recharge===undefined) it.recharge=''; });
  c.notesList.forEach(n=>{ if(!n.id) n.id=uid(); });
  return c;
}

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

function totalLevel(){
  return (CHAR.meta.classes||[]).reduce((s,c)=>s+(Number(c.level)||0),0);
}

let CHAR = loadChar();
let CUSTOM = loadCustom();

function loadChar(){
  try{
    const raw = localStorage.getItem(SHEET_KEY);
    if(raw) return migrateChar(Object.assign(defaultChar(), JSON.parse(raw)));
  }catch(e){}
  return defaultChar();
}
function loadCustom(){
  try{
    const raw = localStorage.getItem(CUSTOM_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  const obj={}; CATS.forEach(c=>obj[c.key]=[]); return obj;
}
let saveTimer=null;
function markSaving(){
  const el=document.getElementById('saveIndicator');
  el.textContent='Salvataggio…'; el.classList.remove('saved');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{
    localStorage.setItem(SHEET_KEY, JSON.stringify(CHAR));
    el.textContent='Salvato ✓ '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    el.classList.add('saved');
  }, 350);
}
function saveCustom(){
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(CUSTOM));
}

/* ---------------- helpers ---------------- */
function mod(score){ return Math.floor((score-10)/2); }
function fmtMod(n){ return (n>=0?'+':'')+n; }
function profBonus(level){ return 2 + Math.floor((Math.max(1,level)-1)/4); }
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function mdLite(text){
  if(!text) return '';
  let t = escapeHtml(text);
  t = t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
  const lines = t.split(/\n/);
  let html=''; let inTable=false; let inList=false;
  for(let line of lines){
    if(/^\s*\|.*\|\s*$/.test(line)){
      if(/^[\s|:\-]+$/.test(line)) continue;
      if(!inTable){ html+='<table class="mdtbl">'; inTable=true; }
      const cells=line.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
      html+='<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
      continue;
    } else if(inTable){ html+='</table>'; inTable=false; }
    if(/^\s*[-*]\s+/.test(line)){
      if(!inList){ html+='<ul>'; inList=true; }
      html+='<li>'+line.replace(/^\s*[-*]\s+/,'')+'</li>';
      continue;
    } else if(inList){ html+='</ul>'; inList=false; }
    if(/^##\s+/.test(line)){ html+='<h4>'+line.replace(/^##\s+/,'')+'</h4>'; continue; }
    if(line.trim()===''){ continue; }
    html+='<p>'+line+'</p>';
  }
  if(inTable) html+='</table>';
  if(inList) html+='</ul>';
  return html;
}

function allEntries(catKey){
  const base = (RULES_DB[catKey]||[]).map(e=>({...e, custom:false}));
  const cust = (CUSTOM[catKey]||[]).map(e=>({...e, custom:true}));
  return base.concat(cust);
}
function allEntriesFlat(){
  let out=[];
  CATS.forEach(c=>{ out = out.concat(allEntries(c.key)); });
  return out;
}
function findEntry(catKey, id){
  return allEntries(catKey).find(e=>e.id===id);
}

/* ---------------- tabs ---------------- */
const TAB_KEY = 'epsilon_active_tab';
function showView(name){
  const btn = document.querySelector('.tab-btn[data-view="'+name+'"]');
  if(!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
  btn.classList.add('active'); btn.setAttribute('aria-selected','true');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  try{ localStorage.setItem(TAB_KEY, name); }catch(e){}
  if(location.hash!=='#'+name) history.replaceState(null,'','#'+name);
  window.scrollTo({top:0});
}
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> showView(btn.dataset.view));
});
window.addEventListener('hashchange', ()=> showView(location.hash.slice(1)));

let toastTimer=null;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), 2200);
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-overlay.open').forEach(m=>closeModal(m.id));
    document.getElementById('dataMenu').open=false;
  }
});
document.addEventListener('click', e=>{
  const menu=document.getElementById('dataMenu');
  if(menu.open && !menu.contains(e.target)) menu.open=false;
});
document.querySelectorAll('#dataMenu .menu-item').forEach(b=> b.addEventListener('click', ()=>{ document.getElementById('dataMenu').open=false; }));
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click', ()=> closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click', (e)=>{ if(e.target===m) closeModal(m.id); });
});
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

/* =========================================================
   SHEET RENDERING
   ========================================================= */
function bindInput(id, getter, setter){
  const el = document.getElementById(id);
  const val = getter();
  if(el.type==='checkbox'){ el.checked = !!val; }
  else { el.value = val ?? ''; }
  // renderAll() runs again after import/reset: only refresh the value, don't stack listeners
  if(el.dataset.bound) return;
  el.dataset.bound = '1';
  el.addEventListener('input', ()=>{
    setter(el.type==='checkbox'?el.checked:(el.type==='number'?(el.value===''?0:Number(el.value)):el.value));
    markSaving();
    renderComputed();
  });
  el.addEventListener('change', ()=>{
    setter(el.type==='checkbox'?el.checked:(el.type==='number'?(el.value===''?0:Number(el.value)):el.value));
    markSaving();
    renderComputed();
  });
}

function byNameIt(a,b){ return a.name.localeCompare(b.name,'it',{sensitivity:'base'}); }

function populateClassRaceSelects(){
  let dl = document.getElementById('classSuggestions');
  dl.innerHTML='';
  allEntries('classes').slice().sort(byNameIt).forEach(c=>{
    const o=document.createElement('option'); o.value=c.name;
    dl.appendChild(o);
  });
  const raceSel = document.getElementById('f_race');
  allEntries('races').slice().sort(byNameIt).forEach(r=>{
    const o=document.createElement('option'); o.value=r.name; o.textContent=r.name;
    raceSel.appendChild(o);
  });
}

function initSheetStaticBindings(){
  bindInput('f_name', ()=>CHAR.meta.name, v=>CHAR.meta.name=v);
  bindInput('f_player', ()=>CHAR.meta.player, v=>CHAR.meta.player=v);
  bindInput('f_xp', ()=>CHAR.meta.xp, v=>CHAR.meta.xp=v);
  bindInput('f_race', ()=>CHAR.meta.raceSel, v=>CHAR.meta.raceSel=v);
  bindInput('f_race_custom', ()=>CHAR.meta.raceCustom, v=>CHAR.meta.raceCustom=v);
  bindInput('f_background', ()=>CHAR.meta.background, v=>CHAR.meta.background=v);
  bindInput('f_alignment', ()=>CHAR.meta.alignment, v=>CHAR.meta.alignment=v);
  bindInput('f_size', ()=>CHAR.meta.size, v=>CHAR.meta.size=v);
  bindInput('f_speed', ()=>CHAR.meta.speed, v=>CHAR.meta.speed=v);
  bindInput('f_empathy', ()=>CHAR.meta.empathy, v=>{
    let n = Number(v); if(isNaN(n)) n=0;
    n = Math.min(300, Math.max(0, n));
    CHAR.meta.empathy = n;
    document.getElementById('f_empathy').value = n;
  });
  bindInput('f_inspiration', ()=>CHAR.meta.inspiration, v=>CHAR.meta.inspiration=v);

  bindInput('f_ac', ()=>CHAR.combat.ac, v=>CHAR.combat.ac=v);
  bindInput('d_init', ()=>CHAR.combat.initiative, v=>CHAR.combat.initiative=v);
  bindInput('d_pp', ()=>CHAR.combat.passivePerception, v=>CHAR.combat.passivePerception=v);
  bindInput('f_hitdice', ()=>CHAR.combat.hitDice, v=>CHAR.combat.hitDice=v);
  bindInput('f_hpmax', ()=>CHAR.combat.hpMax, v=>CHAR.combat.hpMax=v);
  bindInput('f_hpcur', ()=>CHAR.combat.hpCur, v=>CHAR.combat.hpCur=v);
  bindInput('f_hptemp', ()=>CHAR.combat.hpTemp, v=>CHAR.combat.hpTemp=v);

  bindInput('cur_mp', ()=>CHAR.currency.mp, v=>CHAR.currency.mp=v);
  bindInput('cur_mo', ()=>CHAR.currency.mo, v=>CHAR.currency.mo=v);
  bindInput('cur_me', ()=>CHAR.currency.me, v=>CHAR.currency.me=v);
  bindInput('cur_ma', ()=>CHAR.currency.ma, v=>CHAR.currency.ma=v);
  bindInput('cur_mr', ()=>CHAR.currency.mr, v=>CHAR.currency.mr=v);

  bindInput('sp_class', ()=>CHAR.spellcasting.class, v=>CHAR.spellcasting.class=v);
  bindInput('sp_ability', ()=>CHAR.spellcasting.ability, v=>CHAR.spellcasting.ability=v);

  bindInput('f_traits', ()=>CHAR.personality.traits, v=>CHAR.personality.traits=v);
  bindInput('f_ideals', ()=>CHAR.personality.ideals, v=>CHAR.personality.ideals=v);
  bindInput('f_bonds', ()=>CHAR.personality.bonds, v=>CHAR.personality.bonds=v);
  bindInput('f_flaws', ()=>CHAR.personality.flaws, v=>CHAR.personality.flaws=v);
  bindInput('f_proficiencies', ()=>CHAR.proficiencies, v=>CHAR.proficiencies=v);
  bindInput('f_notes', ()=>CHAR.notes, v=>CHAR.notes=v);
}

/* ---- Multiclass ---- */
function renderClasses(){
  const wrap = document.getElementById('classesList');
  wrap.innerHTML='';
  CHAR.meta.classes.forEach((cl,i)=>{
    const row=document.createElement('div');
    row.className='class-row';
    row.innerHTML = `
      <input type="text" list="classSuggestions" placeholder="Classe" data-f="name" value="${escapeHtml(cl.name)}">
      <input type="text" list="subcl_${i}" placeholder="Sottoclasse" data-f="subclass" value="${escapeHtml(cl.subclass)}">
      <datalist id="subcl_${i}">${(window.subclassesFor ? window.subclassesFor(cl.name) : []).map(n=>`<option value="${escapeHtml(n)}">`).join('')}</datalist>
      <input type="number" min="1" max="20" placeholder="Liv." data-f="level" value="${cl.level}">
      <button class="icon-btn" title="Rimuovi classe">✕</button>`;
    row.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        cl[inp.dataset.f] = inp.type==='number' ? (inp.value===''?1:Number(inp.value)) : inp.value;
        markSaving(); renderComputed();
      });
      // cambiata la classe: aggiorna l'elenco delle sottoclassi di quella riga
      if(inp.dataset.f==='name') inp.addEventListener('change', ()=>{
        const dl = row.querySelector('datalist');
        if(dl) dl.innerHTML = (window.subclassesFor ? window.subclassesFor(cl.name) : []).map(n=>`<option value="${escapeHtml(n)}">`).join('');
      });
    });
    row.querySelector('.icon-btn').addEventListener('click', ()=>{
      if(CHAR.meta.classes.length<=1) return;
      CHAR.meta.classes.splice(i,1); renderClasses(); markSaving(); renderComputed();
    });
    wrap.appendChild(row);
  });
}
document.getElementById('btnAddClass').addEventListener('click', ()=>{
  CHAR.meta.classes.push({name:'',subclass:'',level:1});
  renderClasses(); markSaving(); renderComputed();
});

function renderAbilities(){
  const grid = document.getElementById('abilitiesGrid');
  grid.innerHTML='';
  Object.keys(ABILITY_LABELS).forEach(ab=>{
    const box = document.createElement('div');
    box.className='ability-box';
    box.innerHTML = `<label>${ABILITY_LABELS[ab]}</label>
      <input class="ability-score" type="number" id="ab_${ab}" value="${CHAR.abilities[ab]}">
      <div class="ability-mod" id="abmod_${ab}">${fmtMod(mod(CHAR.abilities[ab]))}</div>`;
    grid.appendChild(box);
  });
  Object.keys(ABILITY_LABELS).forEach(ab=>{
    document.getElementById('ab_'+ab).addEventListener('input', e=>{
      CHAR.abilities[ab] = e.target.value===''?10:Number(e.target.value);
      markSaving();
      renderComputed();
    });
  });
}

function renderSaves(){
  const wrap = document.getElementById('savesList');
  wrap.innerHTML='';
  Object.keys(ABILITY_LABELS).forEach(ab=>{
    const row=document.createElement('div');
    row.className='save-row';
    row.innerHTML = `<input type="checkbox" id="sv_${ab}" ${CHAR.saveProf[ab]?'checked':''}>
      <span class="skill-name">${ABILITY_LABELS[ab]}</span>
      <span class="mod-badge" id="svmod_${ab}">+0</span>`;
    wrap.appendChild(row);
  });
  Object.keys(ABILITY_LABELS).forEach(ab=>{
    document.getElementById('sv_'+ab).addEventListener('change', e=>{
      CHAR.saveProf[ab]=e.target.checked; markSaving(); renderComputed();
    });
  });
}

function renderSkills(){
  const wrap = document.getElementById('skillsList');
  wrap.innerHTML='';
  SKILLS.forEach(([key,ab])=>{
    const row=document.createElement('div');
    row.className='skill-row';
    row.innerHTML = `<input type="checkbox" id="sk_${key}" ${CHAR.skills[key].prof?'checked':''}>
      <input type="checkbox" class="chk-exp" id="skx_${key}" title="Expertise" ${CHAR.skills[key].exp?'checked':''}>
      <span class="skill-name">${SKILL_LABELS[key]}</span>
      <span class="skill-ability">${ab.toUpperCase()}</span>
      <span class="mod-badge" id="skmod_${key}">+0</span>`;
    wrap.appendChild(row);
  });
  SKILLS.forEach(([key])=>{
    document.getElementById('sk_'+key).addEventListener('change', e=>{ CHAR.skills[key].prof=e.target.checked; markSaving(); renderComputed(); });
    document.getElementById('skx_'+key).addEventListener('change', e=>{ CHAR.skills[key].exp=e.target.checked; markSaving(); renderComputed(); });
  });
}

function renderDeathSaves(){
  const succ = document.getElementById('ds_success');
  const fail = document.getElementById('ds_fail');
  succ.innerHTML=''; fail.innerHTML='';
  for(let i=1;i<=3;i++){
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked = CHAR.combat.deathSuccess>=i;
    cb.addEventListener('change',()=>{ CHAR.combat.deathSuccess = cb.checked ? i : i-1; markSaving(); renderDeathSaves(); });
    succ.appendChild(cb);
  }
  for(let i=1;i<=3;i++){
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked = CHAR.combat.deathFail>=i;
    cb.addEventListener('change',()=>{ CHAR.combat.deathFail = cb.checked ? i : i-1; markSaving(); renderDeathSaves(); });
    fail.appendChild(cb);
  }
}

function renderComputed(){
  renderHp();
  const level = totalLevel();
  const pb = profBonus(level);
  document.getElementById('d_totallevel').textContent = level;
  document.getElementById('d_prof').textContent = fmtMod(pb);
  const cu = CHAR.currency, coinTot = (Number(cu.mp)||0)*10 + (Number(cu.mo)||0) + (Number(cu.me)||0)*0.5 + (Number(cu.ma)||0)*0.1 + (Number(cu.mr)||0)*0.01;
  const ct = document.getElementById('d_cointotal'); if(ct) ct.textContent = (Math.round(coinTot*100)/100).toLocaleString('it-IT')+' mo';
  renderInventorySummary();

  Object.keys(ABILITY_LABELS).forEach(ab=>{
    const m = mod(CHAR.abilities[ab]);
    const elS = document.getElementById('abmod_'+ab); if(elS) elS.textContent=fmtMod(m);
    const svEl = document.getElementById('svmod_'+ab);
    if(svEl) svEl.textContent = fmtMod(m + (CHAR.saveProf[ab]?pb:0));
  });
  SKILLS.forEach(([key,ab])=>{
    const m = mod(CHAR.abilities[ab]);
    const s = CHAR.skills[key];
    let bonus = m;
    if(s.exp) bonus += pb*2; else if(s.prof) bonus += pb;
    const el = document.getElementById('skmod_'+key);
    if(el) el.textContent = fmtMod(bonus);
  });

  const spAb = CHAR.spellcasting.ability;
  if(spAb && ABILITY_LABELS[spAb]){
    const m = mod(CHAR.abilities[spAb]);
    document.getElementById('d_spelldc').textContent = 8+pb+m;
    document.getElementById('d_spellatk').textContent = fmtMod(pb+m);
  } else {
    document.getElementById('d_spelldc').textContent='—';
    document.getElementById('d_spellatk').textContent='—';
  }
}

/* ---- Attacks ---- */
function renderAttacks(){
  const tbody = document.querySelector('#attacksTable tbody');
  tbody.innerHTML='';
  CHAR.attacks.forEach((atk, i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" list="weaponSuggestions" data-f="name" value="${escapeHtml(atk.name)}"></td>
      <td><input type="text" data-f="bonus" value="${escapeHtml(atk.bonus)}" style="width:4.375rem;"></td>
      <td><input type="text" data-f="damage" value="${escapeHtml(atk.damage)}"></td>
      <td><input type="text" data-f="notes" value="${escapeHtml(atk.notes)}"></td>
      <td><button class="icon-btn" title="Rimuovi">✕</button></td>`;
    tr.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', ()=>{ atk[inp.dataset.f]=inp.value; markSaving(); });
      inp.addEventListener('change', ()=>{
        if(inp.dataset.f==='name'){
          const w = allEntries('weapons').find(w=>w.name===inp.value);
          if(w && w.fields){
            atk.damage = w.fields['Danni']||atk.damage;
            atk.notes = [w.fields['Mastery']?('Mastery: '+w.fields['Mastery']):'', w.fields['Proprietà']||''].filter(Boolean).join(' — ');
            renderAttacks(); markSaving();
          }
        }
      });
    });
    tr.querySelector('.icon-btn').addEventListener('click', ()=>{ CHAR.attacks.splice(i,1); renderAttacks(); markSaving(); });
    tbody.appendChild(tr);
  });
  let dl = document.getElementById('weaponSuggestions');
  if(!dl){ dl=document.createElement('datalist'); dl.id='weaponSuggestions'; document.body.appendChild(dl); }
  dl.innerHTML='';
  allEntries('weapons').slice().sort(byNameIt).forEach(w=>{ const o=document.createElement('option'); o.value=w.name; dl.appendChild(o); });
}
document.getElementById('btnAddAttack').addEventListener('click', ()=>{
  CHAR.attacks.push({name:'',bonus:'',damage:'',notes:''}); renderAttacks(); markSaving();
});

/* ---- Inventory ----
   Ogni oggetto: {name, qty, weight, notes, expanded, where, attune}
   where  = dove si trova: '' (addosso), Zaino, Borsa, Cavalcatura, Deposito… (testo libero)
   attune = '' | 'req' (richiede sintonia) | 'on' (in sintonia, max 3)
   Gli oggetti in Cavalcatura e Deposito non contano nel carico. */
const INV_PLACES = ['Addosso','Zaino','Borsa','Cavalcatura','Deposito'];
const INV_NOT_CARRIED = /^(cavalcatura|deposito|base|carro|nave)/i;
function parseWeightKg(w){
  const t = String(w||'').replace(',', '.');
  const m = t.match(/(\d+(\.\d+)?)/); if(!m) return 0;
  const n = Number(m[1]);
  return /lb|libbr/i.test(t) ? n*0.4536 : /\bg\b|gramm/i.test(t) && !/kg/i.test(t) ? n/1000 : n;
}
function fmtKg(n){ return (Math.round(n*10)/10).toLocaleString('it-IT')+' kg'; }
function carryCapacityKg(){
  const size = String(CHAR.meta.size||'').toLowerCase();
  const k = /enorme|mastodont/.test(size) ? 4 : /grande/.test(size) ? 2 : /minusc/.test(size) ? 0.5 : 1;
  return (Number(CHAR.abilities.str)||10) * 7.5 * k;   // 2024: Forza × 15 lb ≈ Forza × 7,5 kg
}
function renderInventorySummary(){
  const box = document.getElementById('invSummary'); if(!box) return;
  const by = {};
  let carried = 0;
  CHAR.inventory.forEach(it=>{
    const w = parseWeightKg(it.weight) * (Number(it.qty)||0);
    const place = it.where || 'Addosso';
    by[place] = (by[place]||0) + w;
    if(!INV_NOT_CARRIED.test(place)) carried += w;
  });
  const cap = carryCapacityKg();
  const over = carried > cap;
  const att = CHAR.inventory.filter(it=>it.attune==='on').length;
  const pct = cap ? Math.min(100, carried/cap*100) : 0;
  box.innerHTML = `
    <div class="inv-load${over?' over':''}">
      <span>Carico <b>${fmtKg(carried)}</b> / ${fmtKg(cap)}</span>
      <div class="inv-load-bar"><span style="width:${pct}%"></span></div>
      <span class="inv-load-state">${over?'Sovraccarico: velocità 1,5 m':'Normale'}</span>
    </div>
    <div class="inv-places">${Object.entries(by).map(([k,v])=>`<span class="tag-pill">${escapeHtml(k)} · ${fmtKg(v)}</span>`).join('')}
      <span class="tag-pill attune-pill${att>3?' over':''}" title="Oggetti magici in sintonia (massimo 3)">✦ Sintonia ${att}/3</span></div>`;
}
function renderInventory(){
  const tbody = document.querySelector('#inventoryTable tbody');
  tbody.innerHTML='';
  CHAR.inventory.forEach((item,i)=>{
    const tr=document.createElement('tr');
    if(item.notes) tr.title = item.notes;
    if(item.attune==='on') tr.classList.add('attuned');
    tr.innerHTML = `
      <td><button class="icon-btn expand-toggle" title="Mostra/nascondi dettagli">${item.expanded?'▾':'▸'}</button></td>
      <td><input type="text" list="itemSuggestions" data-f="name" value="${escapeHtml(item.name)}">${item.attune==='on'?'<span class="attune-mark" title="In sintonia">✦</span>':''}</td>
      <td><input type="number" data-f="qty" value="${item.qty??1}" style="width:3.4375rem;"></td>
      <td><input type="text" data-f="weight" value="${escapeHtml(item.weight)}" style="width:4.375rem;"></td>
      <td><input type="text" list="placeSuggestions" data-f="where" value="${escapeHtml(item.where||'')}" placeholder="Addosso" style="width:6.5rem;" aria-label="Dove si trova"></td>
      <td><button class="icon-btn remove-btn" title="Rimuovi">✕</button></td>`;
    tr.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        item[inp.dataset.f]= inp.type==='number'?Number(inp.value):inp.value; markSaving();
        if(inp.dataset.f!=='name') renderInventorySummary();
      });
    });
    // peso dal database se il campo è vuoto
    tr.querySelector('[data-f="name"]').addEventListener('change', e=>{
      if(item.weight) return;
      const n = e.target.value.trim().toLowerCase();
      const hit = ['weapons','armor','ammunition','tools','gear','potions'].flatMap(c=>allEntries(c)).find(x=>x.name.toLowerCase()===n);
      if(hit && hit.fields && hit.fields['Peso']){ item.weight = hit.fields['Peso']; tr.querySelector('[data-f="weight"]').value = item.weight; renderInventorySummary(); markSaving(); }
    });
    tr.querySelector('.expand-toggle').addEventListener('click', ()=>{
      item.expanded = !item.expanded; renderInventory(); markSaving();
    });
    tr.querySelector('.remove-btn').addEventListener('click', ()=>{ CHAR.inventory.splice(i,1); renderInventory(); markSaving(); });
    tbody.appendChild(tr);
    if(item.expanded){
      const trD = document.createElement('tr');
      trD.className = 'detail-row';
      trD.innerHTML = `<td colspan="6">
        <div class="attune-row"><label for="att_${i}">Oggetto magico</label>
          <select id="att_${i}">
            <option value=""${!item.attune?' selected':''}>Nessuna sintonia</option>
            <option value="req"${item.attune==='req'?' selected':''}>Richiede sintonia</option>
            <option value="on"${item.attune==='on'?' selected':''}>In sintonia ✦</option>
          </select></div>
        <textarea placeholder="Descrizione, proprietà, note su questo oggetto...">${escapeHtml(item.notes)}</textarea></td>`;
      trD.querySelector('textarea').addEventListener('input', e=>{
        item.notes = e.target.value; tr.title = item.notes; markSaving();
      });
      trD.querySelector('select').addEventListener('change', e=>{
        if(e.target.value==='on' && CHAR.inventory.filter(x=>x!==item && x.attune==='on').length>=3){
          toast('Sei già in sintonia con 3 oggetti: togline uno prima');
          e.target.value = item.attune||''; return;
        }
        item.attune = e.target.value; renderInventory(); markSaving();
      });
      tbody.appendChild(trD);
    }
  });
  let dl = document.getElementById('placeSuggestions');
  if(!dl){ dl=document.createElement('datalist'); dl.id='placeSuggestions'; document.body.appendChild(dl); }
  const places = new Set([...INV_PLACES, ...CHAR.inventory.map(x=>x.where).filter(Boolean)]);
  dl.innerHTML = [...places].map(p=>`<option value="${escapeHtml(p)}">`).join('');
  renderInventorySummary();
}
document.getElementById('btnAddItem').addEventListener('click', ()=>{
  CHAR.inventory.push({name:'',qty:1,weight:'',notes:'',expanded:true,where:'',attune:''}); renderInventory(); markSaving();
});
function populateItemSuggestions(){
  const dl = document.getElementById('itemSuggestions');
  dl.innerHTML='';
  let items=[];
  ['weapons','armor','ammunition','tools','gear','potions'].forEach(cat=>{ items = items.concat(allEntries(cat)); });
  items.sort(byNameIt).forEach(e=>{ const o=document.createElement('option'); o.value=e.name; dl.appendChild(o); });
}

/* ---- Spellcasting slots ---- */
function renderSlots(){
  const grid = document.getElementById('slotsGrid');
  grid.innerHTML='';
  for(let n=1;n<=9;n++){
    const s = CHAR.spellcasting.slots[n];
    s.used = Math.min(s.used||0, s.total||0);
    const box=document.createElement('div');
    box.className='spell-slot'+(s.total?'':' empty');
    let pips='';
    for(let k=1;k<=s.total;k++) pips += `<button class="pip${k<=s.used?' used':''}" data-k="${k}" title="${k<=s.used?'Usato':'Disponibile'}"></button>`;
    box.innerHTML = `<label>Liv ${n}</label>
      <div class="pips">${pips}</div>
      <input type="number" min="0" max="20" data-t="total" value="${s.total}" title="Slot totali di livello ${n}">`;
    box.querySelector('input').addEventListener('change', e=>{ s.total=Math.max(0,Number(e.target.value)||0); renderSlots(); markSaving(); });
    box.querySelectorAll('.pip').forEach(p=> p.addEventListener('click', ()=>{
      const k=Number(p.dataset.k);
      s.used = (s.used===k) ? k-1 : k;   // click the last used pip again to free it
      renderSlots(); markSaving();
    }));
    grid.appendChild(box);
  }
}

/* ---- Spells known list ---- */
let spellSortKey = 'name';
function spellLevelNum(lvl){
  if(!lvl) return 0;
  if(/cantrip/i.test(lvl)) return 0;
  const m = String(lvl).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
function sortedSpellIndexes(){
  const idxs = CHAR.spellcasting.spells.map((sp,idx)=>idx);
  idxs.sort((ia,ib)=>{
    const a = CHAR.spellcasting.spells[ia], b = CHAR.spellcasting.spells[ib];
    let d = 0;
    if(spellSortKey==='level') d = spellLevelNum(a.level)-spellLevelNum(b.level);
    else if(spellSortKey==='school') d = (a.school||'').localeCompare(b.school||'','it',{sensitivity:'base'});
    if(d) return d;
    return (a.name||'').localeCompare(b.name||'','it',{sensitivity:'base'});
  });
  return idxs;
}
function spellLevelDisplay(sp){
  if(sp.level!==undefined && sp.level!==null && SPELL_LEVEL_LABELS[sp.level]!==undefined) return SPELL_LEVEL_LABELS[sp.level];
  return sp.level || '';
}
function renderSpellsTable(){
  const tbody = document.querySelector('#spellsTable tbody');
  tbody.innerHTML='';
  sortedSpellIndexes().forEach(i=>{
    const sp = CHAR.spellcasting.spells[i];
    const tr=document.createElement('tr');
    tr.innerHTML = `<td><input type="checkbox" ${sp.prepared?'checked':''}></td>
      <td>${escapeHtml(sp.name)}${sp.custom?' <span class="badge-custom">custom</span>':''}</td>
      <td>${escapeHtml(spellLevelDisplay(sp))}</td>
      <td>${escapeHtml(sp.school||'')}</td>
      <td><button class="icon-btn remove-btn">✕</button></td>`;
    tr.querySelector('input[type=checkbox]').addEventListener('change', e=>{ sp.prepared=e.target.checked; markSaving(); });
    tr.querySelector('.remove-btn').addEventListener('click', ()=>{ CHAR.spellcasting.spells.splice(i,1); renderSpellsTable(); markSaving(); });
    if(sp.dbId){
      tr.querySelector('td:nth-child(2)').style.cursor='pointer';
      tr.querySelector('td:nth-child(2)').addEventListener('click', ()=> showEntryModal('spells', sp.dbId));
    } else if(sp.custom){
      tr.querySelector('td:nth-child(2)').style.cursor='pointer';
      tr.querySelector('td:nth-child(2)').title='Clicca per vedere/modificare i dettagli';
      tr.querySelector('td:nth-child(2)').addEventListener('click', ()=> openSpellModal(i));
    }
    tbody.appendChild(tr);
  });
}
document.getElementById('spellSort').addEventListener('change', e=>{
  spellSortKey = e.target.value; renderSpellsTable();
});
document.getElementById('spellSearchBox').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const box = document.getElementById('spellSearchResults');
  if(q.length<2){ box.innerHTML=''; return; }
  const results = allEntries('spells').filter(s=> s.name.toLowerCase().includes(q)).sort(byNameIt).slice(0,12);
  box.innerHTML = results.map(s=>
    `<span class="chip" data-id="${s.id}" data-custom="${s.custom}">+ ${escapeHtml(s.name)} <small style="opacity:.6;">(${escapeHtml(s.fields&&s.fields.Level||'')})</small></span>`
  ).join(' ') || '<span class="small-note">Nessun risultato</span>';
  box.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const s = allEntries('spells').find(x=>x.id===chip.dataset.id);
      if(!s) return;
      CHAR.spellcasting.spells.push({name:s.name, level:s.fields&&s.fields.Level||'', school:s.fields&&s.fields.School||'', prepared:false, custom:false, dbId:s.id});
      renderSpellsTable(); markSaving();
      e.target.value=''; box.innerHTML='';
    });
  });
});

/* ---- Custom spell modal: capture everything a spell needs in one place ---- */
let spellEditingIndex = null;
function initSpellSchoolSelect(){
  const sel = document.getElementById('sm_school');
  sel.innerHTML = '<option value="">— nessuna —</option>' + SPELL_SCHOOLS.slice().sort((a,b)=>a.localeCompare(b,'it',{sensitivity:'base'})).map(s=>`<option value="${s}">${s}</option>`).join('');
}
function openSpellModal(index){
  initSpellSchoolSelect();
  if(index!==null && index!==undefined){
    const sp = CHAR.spellcasting.spells[index];
    if(!sp) return;
    spellEditingIndex = index;
    document.getElementById('spellModalTitle').textContent = 'Modifica incantesimo';
    document.getElementById('sm_name').value = sp.name||'';
    document.getElementById('sm_level').value = (sp.level!==undefined && SPELL_LEVEL_LABELS[sp.level]!==undefined) ? sp.level : 0;
    document.getElementById('sm_school').value = sp.school||'';
    document.getElementById('sm_classes').value = sp.classes||'';
    document.getElementById('sm_castingtime').value = sp.castingTime||'';
    document.getElementById('sm_range').value = sp.range||'';
    document.getElementById('sm_comp_v').checked = !!sp.compV;
    document.getElementById('sm_comp_s').checked = !!sp.compS;
    document.getElementById('sm_comp_m').checked = !!sp.compM;
    document.getElementById('sm_comp_material').value = sp.material||'';
    document.getElementById('sm_duration').value = sp.duration||'';
    document.getElementById('sm_concentration').checked = !!sp.concentration;
    document.getElementById('sm_ritual').checked = !!sp.ritual;
    document.getElementById('sm_desc').value = sp.desc||'';
    document.getElementById('sm_delete').style.display='inline-block';
  } else {
    spellEditingIndex = null;
    document.getElementById('spellModalTitle').textContent = 'Incantesimo personalizzato';
    document.getElementById('sm_name').value='';
    document.getElementById('sm_level').value='0';
    document.getElementById('sm_school').value='';
    document.getElementById('sm_classes').value='';
    document.getElementById('sm_castingtime').value='';
    document.getElementById('sm_range').value='';
    document.getElementById('sm_comp_v').checked=false;
    document.getElementById('sm_comp_s').checked=false;
    document.getElementById('sm_comp_m').checked=false;
    document.getElementById('sm_comp_material').value='';
    document.getElementById('sm_duration').value='';
    document.getElementById('sm_concentration').checked=false;
    document.getElementById('sm_ritual').checked=false;
    document.getElementById('sm_desc').value='';
    document.getElementById('sm_delete').style.display='none';
  }
  openModal('spellModal');
  document.getElementById('sm_name').focus();
}
document.getElementById('sm_save').addEventListener('click', ()=>{
  const name = document.getElementById('sm_name').value.trim();
  if(!name){ alert('Inserisci un nome per l\'incantesimo.'); return; }
  const entry = {
    name,
    level: Number(document.getElementById('sm_level').value)||0,
    school: document.getElementById('sm_school').value,
    classes: document.getElementById('sm_classes').value.trim(),
    castingTime: document.getElementById('sm_castingtime').value.trim(),
    range: document.getElementById('sm_range').value.trim(),
    compV: document.getElementById('sm_comp_v').checked,
    compS: document.getElementById('sm_comp_s').checked,
    compM: document.getElementById('sm_comp_m').checked,
    material: document.getElementById('sm_comp_material').value.trim(),
    duration: document.getElementById('sm_duration').value.trim(),
    concentration: document.getElementById('sm_concentration').checked,
    ritual: document.getElementById('sm_ritual').checked,
    desc: document.getElementById('sm_desc').value,
    custom: true,
  };
  if(spellEditingIndex!==null){
    const old = CHAR.spellcasting.spells[spellEditingIndex];
    entry.prepared = old.prepared || false;
    CHAR.spellcasting.spells[spellEditingIndex] = entry;
  } else {
    entry.prepared = false;
    CHAR.spellcasting.spells.push(entry);
  }
  renderSpellsTable(); markSaving();
  closeModal('spellModal');
});
document.getElementById('sm_delete').addEventListener('click', ()=>{
  if(spellEditingIndex===null) return;
  if(!confirm('Eliminare questo incantesimo personalizzato?')) return;
  CHAR.spellcasting.spells.splice(spellEditingIndex,1);
  renderSpellsTable(); markSaving();
  closeModal('spellModal');
});
document.getElementById('btnAddCustomSpell').addEventListener('click', ()=> openSpellModal(null));

/* ---- Features (collapsible, Obsidian-style: click header to expand) ---- */
function featureSourceOptionsHtml(selected){
  return '<option value="">— fonte —</option>' + FEATURE_SOURCES.map(s=>`<option value="${s}"${s===selected?' selected':''}>${s}</option>`).join('');
}
function renderFeatures(){
  const wrap = document.getElementById('featuresList');
  wrap.innerHTML='';
  if(CHAR.features.length===0){ wrap.innerHTML='<div class="empty-hint">Nessun tratto ancora. Aggiungine uno manualmente o dal database.</div>'; return; }
  CHAR.features.forEach((f,i)=>{
    const div=document.createElement('div');
    div.className='feature-card'+(f.expanded?' open':'');
    div.innerHTML = `
      <div class="feature-head">
        <span class="feature-chevron">${f.expanded?'▾':'▸'}</span>
        <input type="text" class="feature-name" value="${escapeHtml(f.name)}">
        <select class="feature-source" title="Da dove viene questo tratto">${featureSourceOptionsHtml(f.source||'')}</select>
        <button class="icon-btn remove-btn" title="Rimuovi">✕</button>
      </div>
      <div class="feature-body" style="display:${f.expanded?'block':'none'};">
        <textarea placeholder="Descrizione...">${escapeHtml(f.desc)}</textarea>
      </div>`;
    const nameInp = div.querySelector('.feature-name');
    const sourceSel = div.querySelector('.feature-source');
    const head = div.querySelector('.feature-head');
    const chevron = div.querySelector('.feature-chevron');
    const body = div.querySelector('.feature-body');
    const desc = div.querySelector('textarea');
    nameInp.addEventListener('click', e=> e.stopPropagation());
    nameInp.addEventListener('input', ()=>{ f.name=nameInp.value; markSaving(); });
    sourceSel.addEventListener('click', e=> e.stopPropagation());
    sourceSel.addEventListener('change', ()=>{ f.source=sourceSel.value; markSaving(); });
    desc.addEventListener('click', e=> e.stopPropagation());
    desc.addEventListener('input', ()=>{ f.desc=desc.value; markSaving(); });
    head.addEventListener('click', (e)=>{
      if(e.target===nameInp || e.target===sourceSel) return;
      f.expanded = !f.expanded;
      chevron.textContent = f.expanded?'▾':'▸';
      body.style.display = f.expanded?'block':'none';
      div.classList.toggle('open', f.expanded);
      markSaving();
    });
    div.querySelector('.remove-btn').addEventListener('click', (e)=>{ e.stopPropagation(); CHAR.features.splice(i,1); renderFeatures(); markSaving(); });
    wrap.appendChild(div);
  });
}
document.getElementById('btnAddFeature').addEventListener('click', ()=>{
  CHAR.features.push({name:'Nuovo tratto', desc:'', source:'', expanded:true}); renderFeatures(); markSaving();
});
document.getElementById('btnAddFeatureFromDb').addEventListener('click', ()=>{
  openPicker();
});

/* ---- Picker modal (features from DB) ---- */
function openPicker(){
  document.getElementById('pickSearch').value='';
  renderPickerResults('');
  openModal('pickModal');
  document.getElementById('pickSearch').focus();
}
document.getElementById('pickSearch').addEventListener('input', e=> renderPickerResults(e.target.value));
const PICKER_CATS = ['races','classes','feats','mastery_properties','weapon_properties','armor_properties','critical_scars','conditions'];
function renderPickerResults(q){
  q=q.trim().toLowerCase();
  let items=[];
  PICKER_CATS.forEach(cat=>{ items = items.concat(allEntries(cat)); });
  if(q) items = items.filter(e=> e.name.toLowerCase().includes(q) || (e.body||'').toLowerCase().includes(q));
  items = items.slice().sort(byNameIt).slice(0,60);
  const wrap = document.getElementById('pickResults');
  wrap.innerHTML = items.map(e=>`
    <div class="entry-card" data-id="${e.id}" data-cat="${e.category}">
      <div class="ehead"><span class="ename">${escapeHtml(e.name)}</span><span class="esub">${CAT_LABEL[e.category]}</span></div>
      <div class="esummary">${escapeHtml((e.body||'').slice(0,140))}</div>
    </div>`).join('') || '<div class="empty-hint">Nessun risultato</div>';
  wrap.querySelectorAll('.entry-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const e = findEntry(card.dataset.cat, card.dataset.id);
      if(!e) return;
      CHAR.features.push({name:e.name, desc:e.body || Object.entries(e.fields||{}).map(([k,v])=>k+': '+v).join(' · '), source:CAT_TO_SOURCE[e.category]||'Altro', expanded:false});
      renderFeatures(); markSaving();
      closeModal('pickModal');
    });
  });
}

/* =========================================================
   DATABASE BROWSER
   ========================================================= */
let dbActiveCat = 'weapons';
let dbActiveSub = '';
let dbQuery = '';

// Testo normalizzato: minuscolo e senza accenti ("Furtività" = "furtivita")
function normTxt(t){ return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
// Punteggio di una voce per la ricerca: 0 = non trovata. Il nome conta più del testo.
function dbMatchScore(e, q){
  const name = normTxt(e.name);
  if(name === q) return 100;
  if(name.startsWith(q)) return 80;
  if(name.split(/[\s'’\-\/()]+/).some(w=>w.startsWith(q))) return 60;
  if(name.includes(q)) return 50;
  if((e.tags||[]).some(t=>normTxt(t).includes(q))) return 30;
  if(Object.values(e.fields||{}).some(v=>normTxt(v).includes(q))) return 20;
  if(normTxt(e.body).includes(q)) return 10;
  return 0;
}
// Ricerca libera in TUTTE le categorie: restituisce [{e, cat, score}] ordinati
function dbSearchAll(q){
  const out=[];
  CATS.forEach(c=>{
    allEntries(c.key).forEach(e=>{
      const score = dbMatchScore(e, q);
      if(score) out.push({e, cat:c.key, score});
    });
  });
  out.sort((a,b)=> b.score-a.score || a.e.name.localeCompare(b.e.name,'it',{sensitivity:'base'}));
  return out;
}
let dbSearchCat = '';   // durante una ricerca: '' = tutte le categorie, altrimenti filtra su una

function renderDbCats(){
  const wrap = document.getElementById('dbCatList');
  wrap.innerHTML='';
  const q = normTxt(dbQuery.trim());
  let counts = null;
  if(q){
    counts = {}; dbSearchAll(q).forEach(r=>{ counts[r.cat]=(counts[r.cat]||0)+1; });
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    const allBtn=document.createElement('button');
    allBtn.className='cat-btn'+(dbSearchCat===''?' active':'');
    allBtn.innerHTML = `<span>Tutti i risultati</span><span class="count">${total}</span>`;
    allBtn.addEventListener('click', ()=>{ dbSearchCat=''; renderDbCats(); renderDbResults(); });
    wrap.appendChild(allBtn);
  }
  CATS.forEach(c=>{
    const btn=document.createElement('button');
    const active = q ? dbSearchCat===c.key : c.key===dbActiveCat;
    const n = q ? (counts[c.key]||0) : allEntries(c.key).length;
    btn.className='cat-btn'+(active?' active':'')+(q && !n?' is-empty':'');
    btn.innerHTML = `<span>${c.label}</span><span class="count">${n}</span>`;
    btn.addEventListener('click', ()=>{
      if(q){ dbSearchCat=c.key; dbActiveCat=c.key; dbActiveSub=''; }   // con una ricerca attiva: filtra, non cancella
      else { dbActiveCat=c.key; dbActiveSub=''; }
      renderDbCats(); renderDbResults();
    });
    wrap.appendChild(btn);
  });
}
document.getElementById('dbSearch').addEventListener('input', e=>{ dbQuery=e.target.value; dbSearchCat=''; renderDbCats(); renderDbResults(); });

function dbCardHtml(e, cat, showCat){
  const summary = e.body ? e.body.replace(/\n+/g,' ').slice(0,150) : Object.entries(e.fields||{}).map(([k,v])=>k+': '+v).join(' · ').slice(0,150);
  const where = [showCat ? (CAT_LABEL[cat]||cat) : '', e.subcategory||''].filter(Boolean).join(' · ');
  return `<div class="entry-card" data-id="${escapeHtml(String(e.id))}" data-cat="${cat}" data-custom="${e.custom}">
    <div class="ehead"><span class="ename">${escapeHtml(e.name)} ${e.custom?'<span class="badge-custom">custom</span>':''}</span><span class="esub">${escapeHtml(where)}</span></div>
    <div class="esummary">${escapeHtml(summary)}</div>
  </div>`;
}

function renderDbResults(){
  const chipsWrap = document.getElementById('dbSubchips');
  const list = document.getElementById('dbResults');
  const q = normTxt(dbQuery.trim());
  chipsWrap.innerHTML='';

  if(q){
    // ---- ricerca libera su tutto il database ----
    let results = dbSearchAll(q);
    if(dbSearchCat) results = results.filter(r=>r.cat===dbSearchCat);
    const where = dbSearchCat ? ('in '+(CAT_LABEL[dbSearchCat]||dbSearchCat)) : 'in tutte le categorie';
    document.getElementById('dbResultCount').textContent = `${results.length} ${results.length===1?'voce':'voci'} ${where}`;
    if(!results.length){
      list.innerHTML = `<div class="empty-hint">Nessun risultato per «${escapeHtml(dbQuery.trim())}» ${where}.${dbSearchCat?' Prova con <b>Tutti i risultati</b>.':' Puoi aggiungerla tu con "+ Aggiungi regola personalizzata".'}</div>`;
      return;
    }
    const shown = results.slice(0,200);
    list.innerHTML = shown.map(r=>dbCardHtml(r.e, r.cat, !dbSearchCat)).join('')
      + (results.length>shown.length ? `<div class="empty-hint">Mostro i primi ${shown.length} risultati: scrivi qualcosa in più per restringere.</div>` : '');
  } else {
    // ---- navigazione per categoria (come prima) ----
    const items = allEntries(dbActiveCat);
    const subs = Array.from(new Set(items.map(i=>i.subcategory).filter(Boolean))).sort();
    if(subs.length>1){
      const allChip=document.createElement('span'); allChip.className='chip'+(dbActiveSub===''?' active':''); allChip.textContent='Tutte';
      allChip.addEventListener('click', ()=>{ dbActiveSub=''; renderDbResults(); });
      chipsWrap.appendChild(allChip);
      subs.forEach(s=>{
        const chip=document.createElement('span'); chip.className='chip'+(dbActiveSub===s?' active':''); chip.textContent=s;
        chip.addEventListener('click', ()=>{ dbActiveSub=s; renderDbResults(); });
        chipsWrap.appendChild(chip);
      });
    }
    const filtered = items.filter(e=> !dbActiveSub || e.subcategory===dbActiveSub);
    document.getElementById('dbResultCount').textContent = filtered.length + ' voci';
    if(filtered.length===0){ list.innerHTML = '<div class="empty-hint">Nessuna voce in questa categoria. Prova ad aggiungerla tu con "+ Aggiungi regola personalizzata".</div>'; return; }
    list.innerHTML = filtered.map(e=>dbCardHtml(e, dbActiveCat, false)).join('');
  }
  list.querySelectorAll('.entry-card').forEach(card=>{
    card.addEventListener('click', ()=> showEntryModal(card.dataset.cat, card.dataset.id));
  });
}

function showEntryModal(catKey, id){
  const e = findEntry(catKey, id);
  if(!e) return;
  const body = document.getElementById('entryModalBody');
  let fieldsHtml='';
  if(e.fields && Object.keys(e.fields).length){
    fieldsHtml = '<table class="field-table">'+Object.entries(e.fields).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`).join('')+'</table>';
  }
  const tagsHtml = (e.tags&&e.tags.length) ? '<div class="tag-row">'+e.tags.map(t=>`<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')+'</div>' : '';
  body.innerHTML = `<h3>${escapeHtml(e.name)} ${e.custom?'<span class="badge-custom">custom</span>':''}</h3>
    <div class="small-note">${CAT_LABEL[e.category]||e.category}${e.subcategory?' · '+escapeHtml(e.subcategory):''}</div>
    ${fieldsHtml}
    <div class="mdbody">${mdLite(e.body)}</div>
    ${tagsHtml}
    ${e.custom?'<div style="margin-top:0.875rem; text-align:right;"><button class="btn small" id="editCustomEntryBtn">Modifica</button></div>':''}`;
  if(e.custom){
    document.getElementById('editCustomEntryBtn').addEventListener('click', ()=>{
      closeModal('entryModal');
      openRuleModal(e.category, e.id);
    });
  }
  openModal('entryModal');
}

/* ---- Add/Edit custom rule modal ---- */
let ruleEditingId = null;
let ruleEditingCat = null;

function initRuleCategorySelect(){
  const sel = document.getElementById('rm_category');
  sel.innerHTML='';
  CATS.forEach(c=>{ const o=document.createElement('option'); o.value=c.key; o.textContent=c.label; sel.appendChild(o); });
}
function addFieldRow(key='',val=''){
  const wrap = document.getElementById('rm_fields');
  const row=document.createElement('div');
  row.className='kv-editor-row';
  row.innerHTML = `<input type="text" placeholder="Chiave (es. Danni)" value="${escapeHtml(key)}" class="rm_fk">
    <input type="text" placeholder="Valore" value="${escapeHtml(val)}" class="rm_fv">
    <button class="icon-btn">✕</button>`;
  row.querySelector('.icon-btn').addEventListener('click', ()=> row.remove());
  wrap.appendChild(row);
}
document.getElementById('rm_addField').addEventListener('click', ()=> addFieldRow());

function openRuleModal(catKey, id){
  initRuleCategorySelect();
  document.getElementById('rm_fields').innerHTML='';
  if(id){
    const e = (CUSTOM[catKey]||[]).find(x=>x.id===id);
    if(!e) return;
    ruleEditingId = id; ruleEditingCat = catKey;
    document.getElementById('ruleModalTitle').textContent='Modifica regola';
    document.getElementById('rm_category').value = catKey;
    document.getElementById('rm_name').value = e.name;
    document.getElementById('rm_subcategory').value = e.subcategory||'';
    document.getElementById('rm_body').value = e.body||'';
    document.getElementById('rm_tags').value = (e.tags||[]).join(', ');
    Object.entries(e.fields||{}).forEach(([k,v])=>addFieldRow(k,v));
    document.getElementById('rm_delete').style.display='inline-block';
  } else {
    ruleEditingId = null; ruleEditingCat = null;
    document.getElementById('ruleModalTitle').textContent='Aggiungi regola personalizzata';
    document.getElementById('rm_category').value = catKey || dbActiveCat;
    document.getElementById('rm_name').value='';
    document.getElementById('rm_subcategory').value='';
    document.getElementById('rm_body').value='';
    document.getElementById('rm_tags').value='';
    addFieldRow();
    document.getElementById('rm_delete').style.display='none';
  }
  openModal('ruleModal');
}
document.getElementById('btnOpenAddRule').addEventListener('click', ()=> openRuleModal(dbActiveCat, null));

document.getElementById('rm_save').addEventListener('click', ()=>{
  const cat = document.getElementById('rm_category').value;
  const name = document.getElementById('rm_name').value.trim();
  if(!name){ alert('Inserisci un nome.'); return; }
  const fields = {};
  document.querySelectorAll('#rm_fields .kv-editor-row').forEach(row=>{
    const k = row.querySelector('.rm_fk').value.trim();
    const v = row.querySelector('.rm_fv').value.trim();
    if(k) fields[k]=v;
  });
  const tags = document.getElementById('rm_tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
  const entry = {
    id: ruleEditingId || (cat.slice(0,3)+'_c'+Date.now()),
    name, category:cat,
    subcategory: document.getElementById('rm_subcategory').value.trim(),
    fields, body: document.getElementById('rm_body').value,
    tags,
  };
  if(!CUSTOM[cat]) CUSTOM[cat]=[];
  if(ruleEditingId && ruleEditingCat){
    const idx = CUSTOM[ruleEditingCat].findIndex(x=>x.id===ruleEditingId);
    if(ruleEditingCat===cat){ CUSTOM[cat][idx]=entry; }
    else { CUSTOM[ruleEditingCat].splice(idx,1); CUSTOM[cat].push(entry); }
  } else {
    CUSTOM[cat].push(entry);
  }
  saveCustom();
  closeModal('ruleModal');
  dbActiveCat = cat;
  renderDbCats(); renderDbResults();
  populateItemSuggestions();
});
document.getElementById('rm_delete').addEventListener('click', ()=>{
  if(!ruleEditingId || !ruleEditingCat) return;
  if(!confirm('Eliminare questa regola personalizzata?')) return;
  CUSTOM[ruleEditingCat] = CUSTOM[ruleEditingCat].filter(x=>x.id!==ruleEditingId);
  saveCustom();
  closeModal('ruleModal');
  renderDbCats(); renderDbResults();
});

/* ---- export/import custom rules ---- */
document.getElementById('btnExportRules').addEventListener('click', ()=>{
  downloadJson(CUSTOM, 'epsilon-regole-custom.json');
});
document.getElementById('btnImportRules').addEventListener('click', ()=> document.getElementById('fileImportRules').click());
document.getElementById('fileImportRules').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      CATS.forEach(c=>{
        if(Array.isArray(data[c.key])){
          if(!CUSTOM[c.key]) CUSTOM[c.key]=[];
          data[c.key].forEach(item=>{
            if(!CUSTOM[c.key].some(x=>x.id===item.id)) CUSTOM[c.key].push(item);
          });
        }
      });
      saveCustom(); renderDbCats(); renderDbResults(); populateItemSuggestions();
      alert('Regole importate correttamente.');
    }catch(err){ alert('File non valido.'); }
  };
  reader.readAsText(file);
  e.target.value='';
});

/* ---- export/import sheet ---- */
function downloadJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj,null,1)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 200);
}
document.getElementById('btnExport').addEventListener('click', ()=>{
  downloadJson({character:CHAR, customRules:CUSTOM}, 'scheda-'+(CHAR.meta.name||'personaggio').replace(/\s+/g,'_')+'.json');
});
document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileImport').click());
document.getElementById('fileImport').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      // data.character may come from an older version of the sheet: normalize
      // it to the current schema (migrateChar) so nothing has to be rebuilt by hand.
      const rawChar = data.character || data; // support both {character:...} wrapper and a bare old-style export
      if(rawChar && typeof rawChar==='object'){
        CHAR = migrateChar(Object.assign(defaultChar(), rawChar));
      }
      if(data.customRules){ CUSTOM = data.customRules; saveCustom(); }
      localStorage.setItem(SHEET_KEY, JSON.stringify(CHAR));
      renderAll();
      alert('Backup caricato e convertito al formato più recente.');
    }catch(err){ alert('File non valido.'); }
  };
  reader.readAsText(file);
  e.target.value='';
});
document.getElementById('btnReset').addEventListener('click', ()=>{
  if(!confirm('Creare un nuovo personaggio? La scheda attuale verrà sovrascritta (esporta prima un backup se vuoi conservarla).')) return;
  CHAR = defaultChar();
  localStorage.setItem(SHEET_KEY, JSON.stringify(CHAR));
  renderAll();
});

/* =========================================================
   PUNTI FERITA: barra, danno/cura rapidi, riposi
   ========================================================= */
function renderHp(){
  const c = CHAR.combat;
  const max = Math.max(0, Number(c.hpMax)||0), cur = Math.max(0, Number(c.hpCur)||0), tmp = Math.max(0, Number(c.hpTemp)||0);
  const total = Math.max(max, cur) + tmp || 1;
  const pct = max ? cur/max : 0;
  const fill = document.getElementById('hpFill'), tf = document.getElementById('hpTempFill');
  fill.style.width = (cur/total*100)+'%';
  fill.className = 'hp-fill' + (pct<=.25 ? ' low' : pct<=.5 ? ' mid' : '');
  tf.style.left = (cur/total*100)+'%'; tf.style.width = (tmp/total*100)+'%';
  document.getElementById('hpText').textContent = `${cur} / ${max}` + (tmp?`  (+${tmp} temp)`:'');
}
function setHpFields(){
  document.getElementById('f_hpcur').value = CHAR.combat.hpCur;
  document.getElementById('f_hptemp').value = CHAR.combat.hpTemp;
  renderHp(); markSaving();
}
function readDelta(){
  const inp=document.getElementById('hpDelta');
  const v=Math.abs(Number(inp.value)||0);
  if(!v){ inp.focus(); return 0; }
  inp.value=''; return v;
}
document.getElementById('btnDamage').addEventListener('click', ()=>{
  let d=readDelta(); if(!d) return;
  const c=CHAR.combat; const tmp=Number(c.hpTemp)||0;
  const absorbed=Math.min(tmp,d); c.hpTemp=tmp-absorbed; d-=absorbed;
  c.hpCur=Math.max(0,(Number(c.hpCur)||0)-d);
  setHpFields();
  toast(c.hpCur===0 ? '💀 A 0 PF — tiri salvezza contro la morte!' : `−${absorbed+d} PF`);
});
document.getElementById('btnHeal').addEventListener('click', ()=>{
  const h=readDelta(); if(!h) return;
  const c=CHAR.combat; const max=Number(c.hpMax)||0;
  c.hpCur = max ? Math.min(max,(Number(c.hpCur)||0)+h) : (Number(c.hpCur)||0)+h;
  if(c.hpCur>0){ c.deathSuccess=0; c.deathFail=0; renderDeathSaves(); }
  setHpFields(); toast(`+${h} PF`);
});
document.getElementById('hpDelta').addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); (e.shiftKey?document.getElementById('btnHeal'):document.getElementById('btnDamage')).click(); }
});
function rechargeConsumables(kinds){
  let n=0;
  CHAR.consumables.forEach(it=>{
    if(kinds.includes(it.recharge) && it.max!=='' && Number(it.max)>0 && it.qty<Number(it.max)){ it.qty=Number(it.max); n++; }
  });
  renderConsumables(); return n;
}
document.getElementById('btnShortRest').addEventListener('click', ()=>{
  const n=rechargeConsumables(['short']); markSaving();
  toast('☕ Riposo breve'+(n?` — ${n} risorse ricaricate`:'')+'. Ricorda: puoi spendere Dadi Vita.');
});
document.getElementById('btnLongRest').addEventListener('click', ()=>{
  if(!confirm('Riposo lungo: PF al massimo, PF temporanei a 0, slot incantesimo e tiri salvezza contro la morte azzerati. Procedere?')) return;
  const c=CHAR.combat;
  c.hpCur=Number(c.hpMax)||c.hpCur; c.hpTemp=0; c.deathSuccess=0; c.deathFail=0;
  Object.values(CHAR.spellcasting.slots).forEach(s=>s.used=0);
  const n=rechargeConsumables(['short','long']);
  setHpFields(); renderDeathSaves(); renderSlots();
  toast('🌙 Riposo lungo completato'+(n?` — ${n} risorse ricaricate`:''));
});

/* =========================================================
   CONSUMABILI
   ========================================================= */
function populateConsSuggestions(){
  const dl=document.getElementById('consSuggestions'); dl.innerHTML='';
  let items=[];
  ['potions','ammunition','poisons'].forEach(cat=>{ items=items.concat(allEntries(cat)); });
  const names=new Set(items.map(e=>e.name).concat(['Pozione di guarigione','Pozione di guarigione superiore','Antitossina','Razioni (1 giorno)','Otre d’acqua','Torcia','Frecce','Quadrelli','Proiettili','Kit del guaritore (uso)','Pergamena magica']));
  [...names].sort((a,b)=>a.localeCompare(b,'it',{sensitivity:'base'})).forEach(n=>{ const o=document.createElement('option'); o.value=n; dl.appendChild(o); });
  const sel=document.getElementById('consFilter');
  if(sel.options.length<=1) CONSUMABLE_CATS.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
}
function guessConsCat(name){
  const n=name.toLowerCase();
  if(/pozion|potion|elisir|antitoss/.test(n)) return 'Pozione';
  if(/frecc|quadrell|proiettil|dard|arrow|bolt|bullet|munizion|knife|coltell/.test(n)) return 'Munizioni';
  if(/velen|poison/.test(n)) return 'Veleno';
  if(/pergamen|scroll/.test(n)) return 'Pergamena';
  if(/razion|cibo|acqua|otre|pane/.test(n)) return 'Cibo & Acqua';
  if(/scrap|ingranagg|bobin|cavo|lente|cristall|batteri|circuit/.test(n)) return 'Scrap';
  return 'Altro';
}
function addConsumable(name){
  name=(name||'').trim();
  const existing = name && CHAR.consumables.find(it=>it.name.toLowerCase()===name.toLowerCase());
  if(existing){ existing.qty=(Number(existing.qty)||0)+1; renderConsumables(); markSaving(); toast(`${existing.name}: ×${existing.qty}`); return; }
  CHAR.consumables.unshift({id:uid(), name, qty:1, max:'', recharge:'', cat: name?guessConsCat(name):'Altro', notes:''});
  renderConsumables(); markSaving();
  if(!name){ const first=document.querySelector('#consList .cons-name'); if(first) first.focus(); }
}
document.getElementById('btnAddCons').addEventListener('click', ()=> addConsumable(''));
document.getElementById('consQuickName').addEventListener('keydown', e=>{
  if(e.key==='Enter' && e.target.value.trim()){ addConsumable(e.target.value); e.target.value=''; }
});
document.getElementById('consSearch').addEventListener('input', renderConsumables);
document.getElementById('consFilter').addEventListener('change', renderConsumables);

function renderConsumables(){
  const list=document.getElementById('consList');
  const q=document.getElementById('consSearch').value.trim().toLowerCase();
  const cat=document.getElementById('consFilter').value;
  const total=CHAR.consumables.reduce((s,it)=>s+(Number(it.qty)||0),0);
  document.getElementById('consCount').textContent = CHAR.consumables.length ? total : '';
  const items=CHAR.consumables.filter(it=> (!cat||it.cat===cat) && (!q || (it.name+' '+(it.notes||'')).toLowerCase().includes(q)));
  list.innerHTML='';
  if(!CHAR.consumables.length){ list.innerHTML='<div class="empty-hint">Nessun consumabile. Scrivi un oggetto qui sopra e premi Invio, oppure usa <b>+ Aggiungi</b>.</div>'; return; }
  if(!items.length){ list.innerHTML='<div class="empty-hint">Nessun oggetto corrisponde al filtro.</div>'; return; }
  items.forEach(it=>{
    const card=document.createElement('div');
    card.className='cons-card'+(Number(it.qty)<=0?' out':'');
    const catOpts=CONSUMABLE_CATS.map(c=>`<option${c===it.cat?' selected':''}>${c}</option>`).join('');
    const rcOpts=Object.entries(RECHARGE_LABELS).map(([k,v])=>`<option value="${k}"${k===it.recharge?' selected':''}>${v}</option>`).join('');
    card.innerHTML=`
      <div class="cons-main">
        <input type="text" class="cons-name" value="${escapeHtml(it.name)}" placeholder="Nome oggetto">
        <select class="cons-cat">${catOpts}</select>
      </div>
      <div class="cons-counter">
        <button data-a="dec" title="Usa / consuma 1">−</button>
        <span class="cons-qty">${it.qty}${it.max!==''&&Number(it.max)>0?`<small>/${it.max}</small>`:''}</span>
        <button data-a="inc" title="Aggiungi 1">+</button>
      </div>
      <div class="cons-extra">
        <input type="number" min="0" class="cons-maxin" value="${it.max}" placeholder="Max" title="Quantità massima (opzionale)">
        <select class="cons-rc" title="Si ricarica con…">${rcOpts}</select>
        <input type="text" class="cons-notes" value="${escapeHtml(it.notes||'')}" placeholder="Effetto / note (es. 2d4+2 PF)">
        <button class="icon-btn" data-a="del" title="Rimuovi">✕</button>
      </div>`;
    card.querySelector('.cons-name').addEventListener('input', e=>{ it.name=e.target.value; markSaving(); });
    card.querySelector('.cons-cat').addEventListener('change', e=>{ it.cat=e.target.value; markSaving(); });
    card.querySelector('.cons-notes').addEventListener('input', e=>{ it.notes=e.target.value; markSaving(); });
    card.querySelector('.cons-rc').addEventListener('change', e=>{ it.recharge=e.target.value; markSaving(); });
    card.querySelector('.cons-maxin').addEventListener('change', e=>{ it.max = e.target.value===''?'':Math.max(0,Number(e.target.value)); renderConsumables(); markSaving(); });
    card.querySelector('[data-a="dec"]').addEventListener('click', ()=>{
      if(Number(it.qty)<=0) return;
      it.qty=Number(it.qty)-1; renderConsumables(); markSaving();
      toast(it.qty===0 ? `${it.name||'Oggetto'} esaurito` : `${it.name||'Oggetto'}: ne restano ${it.qty}`);
    });
    card.querySelector('[data-a="inc"]').addEventListener('click', ()=>{ it.qty=Number(it.qty)+1; renderConsumables(); markSaving(); });
    card.querySelector('[data-a="del"]').addEventListener('click', ()=>{
      if(!confirm(`Rimuovere «${it.name||'oggetto'}» dai consumabili?`)) return;
      CHAR.consumables=CHAR.consumables.filter(x=>x!==it); renderConsumables(); markSaving();
    });
    list.appendChild(card);
  });
}

/* =========================================================
   APPUNTI PERSONALI
   ========================================================= */
let activeNoteId = null;
function fmtDate(ts){ return new Date(ts).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}); }
function sortedNotes(){
  return CHAR.notesList.slice().sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || b.updated-a.updated);
}
function addNote(title, body){
  const now=Date.now();
  const n={id:uid(), title:title||'', body:body||'', created:now, updated:now, pinned:false};
  CHAR.notesList.push(n); activeNoteId=n.id;
  renderNotesList(); renderNoteEditor(); markSaving();
  const t=document.getElementById(title?'noteBody':'noteTitle'); t.focus();
}
document.getElementById('btnAddNote').addEventListener('click', ()=> addNote('',''));
document.getElementById('btnAddSessionNote').addEventListener('click', ()=>{
  const d=new Date().toLocaleDateString('it-IT',{weekday:'long', day:'numeric', month:'long', year:'numeric'});
  addNote('Sessione — '+d, '');
});
document.getElementById('notesSearch').addEventListener('input', renderNotesList);
function renderNotesList(){
  const wrap=document.getElementById('notesList');
  const q=document.getElementById('notesSearch').value.trim().toLowerCase();
  const notes=sortedNotes().filter(n=> !q || (n.title+' '+n.body).toLowerCase().includes(q));
  if(!activeNoteId || !CHAR.notesList.some(n=>n.id===activeNoteId)) activeNoteId = sortedNotes()[0]?.id || null;
  wrap.innerHTML = notes.map(n=>`
    <button class="note-item${n.id===activeNoteId?' active':''}" data-id="${n.id}">
      <div class="nt">${n.pinned?'★ ':''}${escapeHtml(n.title||'Senza titolo')}</div>
      <div class="nd">${fmtDate(n.updated)}</div>
      <div class="np">${escapeHtml((n.body||'').split('\n').find(l=>l.trim())||'')}</div>
    </button>`).join('') || `<div class="empty-hint">${q?'Nessun risultato.':'Ancora nessun appunto.'}</div>`;
  wrap.querySelectorAll('.note-item').forEach(b=> b.addEventListener('click', ()=>{
    activeNoteId=b.dataset.id; renderNotesList(); renderNoteEditor();
    if(window.innerWidth<860) document.getElementById('notesEditor').scrollIntoView({behavior:'smooth'});
  }));
}
function activeNote(){ return CHAR.notesList.find(n=>n.id===activeNoteId); }
function renderNoteEditor(){
  const n=activeNote();
  document.getElementById('notesEmpty').style.display = n?'none':'block';
  document.getElementById('notesForm').style.display = n?'block':'none';
  if(!n) return;
  document.getElementById('noteTitle').value=n.title;
  document.getElementById('noteBody').value=n.body;
  document.getElementById('noteMeta').textContent=`Creato ${fmtDate(n.created)} · modificato ${fmtDate(n.updated)}`;
  const pin=document.getElementById('btnPinNote');
  pin.textContent=n.pinned?'★':'☆'; pin.classList.toggle('pinned',!!n.pinned);
}
let noteListTimer=null;
function touchNote(){
  const n=activeNote(); if(!n) return;
  n.updated=Date.now(); markSaving();
  clearTimeout(noteListTimer); noteListTimer=setTimeout(renderNotesList, 400);
}
document.getElementById('noteTitle').addEventListener('input', e=>{ const n=activeNote(); if(n){ n.title=e.target.value; touchNote(); } });
document.getElementById('noteBody').addEventListener('input', e=>{ const n=activeNote(); if(n){ n.body=e.target.value; touchNote(); } });
document.getElementById('btnPinNote').addEventListener('click', ()=>{ const n=activeNote(); if(!n) return; n.pinned=!n.pinned; renderNoteEditor(); renderNotesList(); markSaving(); });
document.getElementById('btnDeleteNote').addEventListener('click', ()=>{
  const n=activeNote(); if(!n) return;
  if(!confirm(`Eliminare l'appunto «${n.title||'Senza titolo'}»?`)) return;
  CHAR.notesList=CHAR.notesList.filter(x=>x!==n); activeNoteId=null;
  renderNotesList(); renderNoteEditor(); markSaving();
});

/* =========================================================
   RECAP SESSIONI
   ========================================================= */
function getRecapUrl(){ try{ return localStorage.getItem(RECAP_KEY) || RECAP_URL_DEFAULT; }catch(e){ return RECAP_URL_DEFAULT; } }
function openRecapSettings(){
  document.getElementById('recapUrlInput').value=getRecapUrl();
  openModal('recapModal'); document.getElementById('recapUrlInput').focus();
}
document.getElementById('btnRecap').addEventListener('click', ()=>{
  const url=getRecapUrl();
  if(url) window.open(url,'_blank','noopener'); else openRecapSettings();
});
document.getElementById('btnRecapSettings').addEventListener('click', openRecapSettings);
document.getElementById('recapSave').addEventListener('click', ()=>{
  let url=document.getElementById('recapUrlInput').value.trim();
  if(url && !/^https?:\/\//i.test(url) && !/^obsidian:\/\//i.test(url)) url='https://'+url;
  if(!url){ alert('Incolla un link prima di salvare.'); return; }
  localStorage.setItem(RECAP_KEY,url); closeModal('recapModal');
  window.open(url,'_blank','noopener');
});
document.getElementById('recapClear').addEventListener('click', ()=>{
  localStorage.removeItem(RECAP_KEY); document.getElementById('recapUrlInput').value=RECAP_URL_DEFAULT;
  toast('Link recap rimosso'); closeModal('recapModal');
});

/* =========================================================
   INIT
   ========================================================= */
function renderAll(){
  populateClassRaceSelects();
  populateConsSuggestions();
  initSheetStaticBindings();
  renderClasses();
  renderAbilities();
  renderSaves();
  renderSkills();
  renderDeathSaves();
  renderAttacks();
  renderInventory();
  populateItemSuggestions();
  renderSlots();
  renderSpellsTable();
  renderFeatures();
  renderComputed();
  renderConsumables();
  renderNotesList(); renderNoteEditor();
  renderDbCats();
  renderDbResults();
}

// clear dynamic selects/options that shouldn't accumulate on re-render
function resetSelectOptions(){
  const raceSel = document.getElementById('f_race');
  if(raceSel) raceSel.innerHTML='<option value="">— seleziona o scrivi sotto —</option>';
}
const _origRenderAll = renderAll;
renderAll = function(){ resetSelectOptions(); _origRenderAll(); };

renderAll();
(function(){
  let v=location.hash.slice(1);
  if(!document.getElementById('view-'+v)){ try{ v=localStorage.getItem(TAB_KEY)||'sheet'; }catch(e){ v='sheet'; } }
  if(document.getElementById('view-'+v)) showView(v);
})();

// --- theme selector wiring ---
(function(){
        var sel = document.getElementById('themeSelect');
        sel.value = localStorage.getItem('epsilon_theme') || 'teal';
        sel.addEventListener('change', function(){
          document.documentElement.setAttribute('data-theme', sel.value);
          localStorage.setItem('epsilon_theme', sel.value);
        });
      })();
