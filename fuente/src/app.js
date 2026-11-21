/* ══ app.js — interfaz de SanitarIA de Combate ══
   El motor (motor.js) y los escenarios (escenarios.js) son lógica pura: aquí solo se pinta, se escucha y se habla.
   La IA es opcional: interpreta frases que el catálogo no reconoce y redacta un comentario final. Nunca puntúa. */
const VERSION = '2.0.0';
const STEPS = ['Inicio', 'Preparación', 'Simulación', 'Debriefing'];
const HUBS = ['Instructor', 'Órdenes y protocolos', 'Mi progreso'];
const NAV = [['Empezar', 'Prueba el ejemplo: funciona sin clave de IA.'], ['Comenzar la simulación', 'Elige nivel y escenario.'], ['Terminar y ver el debriefing', 'Habla o escribe tus órdenes.'], ['Volver al inicio', 'Descarga tu informe o repite el escenario.']];
const RENDER = {0: pintaInicio, 1: pintaPrep, 2: pintaSim, 3: pintaDebrief, 4: pintaInstr, 5: pintaOrdenes, 6: pintaProgreso};
const GLOS = [
  ['¿Qué es?', 'Un simulador por voz de atención táctica a bajas con 15 escenarios basados en las guías de atención táctica a bajas (TCCC) y cuatro niveles: todo combatiente (ASM), socorrista (CLS), sanitario de combate (CMC) y médico o enfermero (CPP).'],
  ['Voz', 'Pulsa el micrófono (o mantén la barra espaciadora) y da la orden como en el terreno. Con «manos libres» escucha sin parar. El reconocimiento lo hace tu navegador, gratis: Chrome y Edge lo envían a Google o Microsoft y necesitan red; Safari usa el de Apple; Firefox no tiene, y entonces se escribe.'],
  ['¿Quién decide qué?', 'El código lleva la fisiología de cada baja, el reloj y la rúbrica. La IA, si la activas, solo traduce frases que el simulador no entiende a órdenes del catálogo y redacta un comentario final; nunca puntúa.'],
  ['Rúbrica', 'Cada escenario tiene su lista de puntos, que el código comprueba con el registro de la sesión. Los puntos críticos valen doble y un fallo crítico impide el APTO.'],
  ['Niveles', 'Si das una orden fuera del alcance de tu nivel, el simulador no la ejecuta, te dice a quién pedírsela y lo anota como fallo crítico.'],
  ['Instructor', 'En «Instructor» generas un código de sesión común, inyectas complicaciones durante la simulación y reúnes los JSON de tu grupo en una tabla con la dificultad de cada punto.'],
  ['Privacidad', 'Todo se guarda en este navegador. Tu voz sale hacia el servicio de reconocimiento del navegador: no digas datos reales. Si activas la IA, salen las frases no reconocidas y el resumen del debriefing, sin tu seudónimo.'],
  ['Límites', 'Es un modelo docente simplificado, no un simulador fisiológico validado. No sustituye a los protocolos de tu unidad ni a la supervisión docente. Ningún contenido debe aplicarse a pacientes ni operaciones reales.']
];
let S = {nivel: 'CMC', esc: 'cuf', vel: 1, alias: '', habla: true, ia: false, instr: false, hist: [], ult: null, agreg: []};
const SIM = {st: null, esc: null, run: false, pausa: false, timer: null, decPend: null, form: null, ultimo: '', med: {}, tVoz: {}, demo: false, nEv: 0, ia: false};
let ENVIO_OK = false;
const NIV_TXT = {
  ASM: ['Todo combatiente (ASM)', 'Autoayuda y ayuda a un compañero: torniquete, empaquetado, presión, posición lateral, parche torácico, hipotermia e informar.'],
  CLS: ['Socorrista de combate (CLS)', 'Además: cánula nasofaríngea, descompresión con aguja, faja pélvica, MACE 2, 9 líneas y MIST.'],
  CMC: ['Sanitario de combate (CMC)', 'Además: vías IV/IO, ácido tranexámico, sangre total, analgesia, cricotiroidotomía, toracostomía y conversión del torniquete.'],
  CPP: ['Médico / enfermero de combate (CPP)', 'Todo lo anterior, más certificar el fallecimiento y las decisiones de control médico.']
};
const CATS = {M: 'M · Hemorragia', A: 'A · Vía aérea', R: 'R · Respiración', C: 'C · Circulación', H: 'H · Cabeza e hipotermia', E: 'Evaluación', P: 'Dolor, fármacos y lesiones', K: 'Comunicación y evacuación', T: 'Triaje y final de la vida'};
const FASES = {1: 'Fase 1 · Bajo fuego y hemorragia', 2: 'Fase 2 · Atención táctica en campo (MARCH)', 3: 'Fase 3 · Triaje, evacuación y documentación', 4: 'Módulos especiales'};
/* traduce un mensaje del motor: {k, a} → texto en el idioma actual (los objetos {es,en,pt} se resuelven; las cadenas se traducen si hay entrada) */
const arg = x => x && typeof x === 'object' ? tx3(x, LANG) : typeof x === 'string' ? t(x) : x;
const fmt = (k, a = []) => t(k, ...a.map(arg));
const L = o => tx3(o, LANG);
const nomAcc = id => L(ACC[id].n);

/* ── pantalla 0 ── */
function pintaInicio() { detenSim(); const u = S.ult; $('inicioProj').innerHTML = u ? `${esc(t('Tu último resultado: {0} en {1} ({2}).', u.pct + ' %', L(escDe(u.esc).tit), u.nivel))} <button class="btn btn-ghost btn-sm" id="btnCont" type="button">${esc(t('Verlo'))}</button>` : ''; }
$('btnStart').onclick = () => go(1);
$('btnEjemplo').onclick = () => demo();
document.addEventListener('click', e => { if (e.target.closest('#btnCont')) go(3); });
$('btnInstrHub').onclick = () => go(4); $('btnOrdHub').onclick = () => go(5); $('btnProgHub').onclick = () => go(6);

/* ── pantalla 1: preparación ── */
function pintaPrep() {
  detenSim();
  $('niveles').innerHTML = NIVELES.map(n => `<button type="button" role="radio" class="sc-niv" aria-checked="${S.nivel === n}" data-niv="${n}"><b>${esc(t(NIV_TXT[n][0]))}</b><span>${esc(t(NIV_TXT[n][1]))}</span></button>`).join('');
  $$('#niveles [data-niv]').forEach(b => b.onclick = () => { S.nivel = b.dataset.niv; guarda(); pintaPrep(); });
  const mejor = (e, n) => Math.max(-1, ...S.hist.filter(h => h.esc === e && h.nivel === n).map(h => h.pct));
  $('escenarios').innerHTML = [1, 2, 3, 4].map(f => `<h4 class="sc-fase">${esc(t(FASES[f]))}</h4><div class="sc-escs">${ESC.filter(e => e.fase === f).map(e => { const m = mejor(e.id, S.nivel); return `<button type="button" class="sc-esc" aria-pressed="${S.esc === e.id}" data-esc="${e.id}"><span class="sc-ico" aria-hidden="true">${e.ico}</span><b>${esc(L(e.tit))}</b><span>${esc(L(e.sub))}</span>${m >= 0 ? `<small>${esc(t('mejor: {0} %', m))}</small>` : ''}</button>`; }).join('')}</div>`).join('');
  $$('#escenarios [data-esc]').forEach(b => b.onclick = () => { S.esc = b.dataset.esc; guarda(); pintaPrep(); });
  $('selVel').value = String(S.vel); $('alias').value = S.alias; $('chkHabla').checked = S.habla; $('chkIA').checked = S.ia; $('chkInstr').checked = S.instr;
  $('nivelAyuda').textContent = t('El nivel decide qué órdenes puedes ejecutar y qué puntos de la rúbrica se te exigen.');
}
$('selVel').onchange = e => { S.vel = +e.target.value; guarda(); };
$('alias').oninput = e => { S.alias = e.target.value.trim(); guarda(); };
$('chkHabla').onchange = e => { S.habla = e.target.checked; VOZ.hablaOn = S.habla; guarda(); };
$('chkIA').onchange = e => { S.ia = e.target.checked; guarda(); if (S.ia && !getKey()) pideClave(); };
$('chkInstr').onchange = e => { S.instr = e.target.checked; guarda(); };
/* código de sesión: escenario.nivel.velocidad (p. ej. cuf.CMC.1) */
function aplicaCodigo(c) {
  const [e, n, v] = String(c || '').trim().split(/[.\s-]+/);
  if (!ESC.some(x => x.id === e) || !NIVELES.includes((n || '').toUpperCase())) return false;
  S.esc = e; S.nivel = n.toUpperCase(); S.vel = [1, 2, 4].includes(+v) ? +v : 1; guarda(); return true;
}
$('codigo').onchange = e => { if (!e.target.value.trim()) return; if (aplicaCodigo(e.target.value)) { toast(t('Sesión cargada: {0}, nivel {1}.', L(escDe(S.esc).tit), S.nivel)); pintaPrep(); } else toast(t('Código no válido. Tiene la forma escenario.nivel.velocidad, por ejemplo cuf.CMC.1')); };
$('btnMic').onclick = () => {
  if (!VOZ.disponible()) { $('micEstado').textContent = t('Tu navegador no reconoce voz (Firefox no lo permite). Usa Chrome, Edge o Safari, o escribe las órdenes.'); return; }
  $('micEstado').textContent = t('Di algo, por ejemplo «torniquete alto y apretado»…');
  const prev = VOZ.onFrase; VOZ.onFrase = alts => { VOZ.onFrase = prev; VOZ.para(); const ids = interpreta(alts[0], LANG); $('micEstado').textContent = t('He oído: «{0}».', alts[0]) + ' ' + (ids.length ? t('Lo entiendo como: {0}.', ids.map(nomAcc).join(', ')) : t('No reconozco ninguna orden en esa frase.')); };
  VOZ.inicia();
};
$('btnComenzar').onclick = () => go(2);
const CAN_NEXT = i => { if (i === 2 && SIM.run) finaliza(); return true; };
/* salir de la simulación a otra pantalla la detiene (no sigue corriendo el reloj a escondidas) */
function detenSim() { if (SIM.run && !SIM.demo) { SIM.run = false; paraReloj(); VOZ.para(); VOZ.calla(); } else if (SIM.demo) { SIM.demo = false; SIM.run = false; paraReloj(); VOZ.calla(); } }

/* ── pantalla 2: simulación ── */
function nuevaSim() {
  const e = escDe(S.esc); paraReloj();
  SIM.esc = e; SIM.st = nuevaSesion(e, S.nivel, {lang: LANG, semilla: S.esc + '.' + S.nivel + '.' + S.vel}); pretratar(SIM.st, e);
  SIM.run = true; SIM.pausa = false; SIM.decPend = null; SIM.form = null; SIM.med = {}; SIM.tVoz = {}; SIM.nEv = 0; SIM.ia = S.ia && !!getKey();
  $('log').innerHTML = ''; $('sug').innerHTML = ''; $('brief').open = true; $('orden').value = ''; VOZ.hablaOn = S.habla;
  msg('instructor', L(e.brief), true);
  SIM.timer = setInterval(latido, 1000);
}
function pintaSim() {
  if (!SIM.run) nuevaSim();
  const e = SIM.esc;
  $('briefTxt').innerHTML = `<p><b>${esc(L(e.tit))}</b> · ${esc(L(e.sub))} · ${esc(t('nivel {0}', S.nivel))}</p><p>${esc(L(e.brief))}</p>`;
  $('chuleta').innerHTML = Object.keys(CATS).map(c => { const ids = ACC_IDS.filter(id => ACC[id].c === c && ACC[id].min <= NIV[S.nivel]); return ids.length ? `<h4 class="sc-fase">${esc(t(CATS[c]))}</h4><ul class="sc-ul">${ids.map(id => `<li><b>${esc(nomAcc(id))}</b> — «${esc(L(ACC[id].k).split('|')[0].trim())}»</li>`).join('')}</ul>` : ''; }).join('');
  $('panelInstr').hidden = !S.instr;
  if (S.instr) $('panelInstr').innerHTML = `<h3>${esc(t('Consola del instructor'))}</h3><p class="help">${esc(t('Afecta a la baja seleccionada. Queda en el registro.'))}</p><div class="sc-chips">${INYECCIONES.map(i => `<button type="button" class="btn btn-ghost btn-sm" data-iny="${i}">${esc(t(NOM_INY[i]))}</button>`).join('')}</div>`;
  $$('#panelInstr [data-iny]').forEach(b => b.onclick = () => { const ev = inyecta(SIM.st, b.dataset.iny, SIM.st.act); SIM.st.log.push({t: Math.round(SIM.st.t), a: '_iny_' + b.dataset.iny, b: ev.b, fase: SIM.st.fase}); refresca(); });
  refresca();
}
const NOM_INY = {resangrado: 'Resangrado', neumo: 'Neumotórax a tensión', fuego: 'Fuego enemigo', hipotermia: 'Lluvia y frío', vomito: 'Vómito', hernia: 'Herniación', radio: 'Sin radio 2 min', convulsion: 'Convulsión'};
function paraReloj() { clearInterval(SIM.timer); SIM.timer = null; }
function latido() {
  const st = SIM.st; if (!SIM.run || SIM.pausa || SIM.decPend || SIM.form) { if (SIM.run) pintaHud(); return; }
  tick(st, S.vel * (SIM.demo ? 4 : 1)); controlFuego(st);
  revisaEventos(); revisaDecisiones(); vozBaja();
  const vivos = st.bajas.filter(b => !b.expectante && !b.muerto).length, recup = st.bajas.filter(b => !b.expectante).length;
  if (st.t >= SIM.esc.dur) { msg('instructor', t('Tiempo cumplido. Fin del ejercicio.'), true); return finaliza(); }
  if (recup && !vivos) { msg('instructor', t('No quedan bajas recuperables con vida. Fin del ejercicio.'), true); return finaliza(); }
  refresca();
}
function revisaEventos() { const st = SIM.st; while (SIM.nEv < st.ev.length) { const e = st.ev[SIM.nEv++]; msg(e.iny ? 'instructor' : 'sistema', fmt(e.k, [e.b, ...(e.a || [])]), true); } }
function revisaDecisiones() {
  if (SIM.decPend) return; const d = (SIM.esc.dec || []).find(x => !(x.id in SIM.st.dec) && SIM.st.t >= x.t);
  if (!d) return; SIM.decPend = d; msg('instructor', L(d.q) + ' ' + d.ops.map(o => o.k.toUpperCase() + ': ' + L(o.txt)).join(' · '), true); pintaDec();
}
function pintaDec() {
  const d = SIM.decPend, p = $('panelDec'); p.hidden = !d; if (!d) return;
  p.innerHTML = `<h3>${esc(t('Decisión'))} <span class="fa-chip aviso">${esc(t('el reloj se detiene'))}</span></h3><p>${esc(L(d.q))}</p><div class="sc-ops">${d.ops.map(o => `<button type="button" class="btn btn-ghost" data-op="${o.k}"><b>${o.k.toUpperCase()}</b> ${esc(L(o.txt))}</button>`).join('')}</div><p class="help">${esc(t('Di «opción A», «opción B»… o pulsa.'))}</p>`;
  $$('#panelDec [data-op]').forEach(b => b.onclick = () => responde(b.dataset.op));
}
function responde(k) {
  const d = SIM.decPend; if (!d || !d.ops.some(o => o.k === k)) return;
  SIM.st.dec[d.id] = k; SIM.st.log.push({t: Math.round(SIM.st.t), a: '_dec_' + d.id, b: '—', fase: SIM.st.fase, n: k, ok: k === d.ok});
  SIM.decPend = null; $('panelDec').hidden = true;
  msg('instructor', (k === d.ok ? t('Correcto.') : t('No es la mejor opción.')) + ' ' + L(d.fb), true); refresca();
}
/* frases de la baja según su estado (deterministas; cada baja habla como mucho cada ~40 s simulados) */
function vozBaja() {
  const st = SIM.st, b = bajaAct(st); if (b.muerto) return;
  const last = SIM.tVoz[b.id] ?? -99; if (st.t - last < 40) return;
  const v = vitales(b); let f = null;
  if (v.avdn === 'A') f = b.neumo && b.neumo.sev > .4 ? 'No… puedo… respirar…' : b.nrbq && b.nrbq.sev > .3 ? 'No veo bien… me ahogo…' : hemorragiaActiva(b) ? '¡Estoy sangrando mucho! ¡Haz algo!' : b.temp < 35.3 ? 'Tengo mucho frío…' : v.dolor > 6 ? '¡Me duele muchísimo! ¿Es grave?' : null;
  else if (v.avdn === 'V') f = 'Mmm… ¿qué… ha pasado?';
  else if (v.avdn === 'D') f = '(gime)';
  if (f) { SIM.tVoz[b.id] = st.t; msg('baja', t(f), f !== '(gime)', b.id); }
}
function refresca() { pintaHud(); pintaBajas(); pintaPanelBaja(); pintaDec(); pintaForm(); }
function pintaHud() {
  const st = SIM.st; if (!st) return;
  $('hud').innerHTML = `<span class="sc-reloj" aria-label="${esc(t('Tiempo'))}">${mmss(st.t)}<small> / ${mmss(SIM.esc.dur)}</small></span><span class="fa-chip ${st.fase === 'cuf' ? 'error' : 'ok'}">${st.fase === 'cuf' ? esc(t('BAJO FUEGO')) : esc(t('Atención en campo'))}</span>${st.fuego ? `<span class="fa-chip error">🔥 ${esc(t('fuego enemigo eficaz'))}</span>` : ''}${st.sinRadio > st.t ? `<span class="fa-chip aviso">📻 ${esc(t('sin radio'))}</span>` : ''}<span class="fa-chip">${esc(S.nivel)} · ${S.vel}×</span>${SIM.pausa ? `<span class="fa-chip aviso">${esc(t('en pausa'))}</span>` : ''}${SIM.demo ? `<span class="fa-chip aviso">${esc(t('ejemplo automático'))}</span>` : ''}${VOZ.escuchando ? `<span class="fa-chip ok">🎙 ${esc(t('escuchando'))}</span>` : ''}`;
}
const CAT_COL = {urgente: '#C0392B', prioritario: '#C98200', rutina: '#0E8C7A', expectante: '#1F6FB2'};
function pintaBajas() {
  const st = SIM.st;
  $('bajas').innerHTML = st.bajas.map((b, i) => `<button type="button" role="tab" aria-selected="${i === st.act}" class="sc-tab" data-b="${i}" style="--cc:${CAT_COL[b.cat] || '#7C93AC'}"><b>${b.id}</b> ${esc(L(b.nombre))}${b.cat ? ` <span class="sc-cat">${esc(t(b.cat.toUpperCase()))}</span>` : ''}${b.muerto ? ' ✝' : hemorragiaActiva(b) ? ' 🩸' : ''}</button>`).join('');
  $$('#bajas [data-b]').forEach(x => x.onclick = () => { st.act = +x.dataset.b; refresca(); });
  $('bajas').hidden = st.bajas.length < 2;
}
const ASPECTO = {A: 'Consciente: habla y obedece', V: 'Responde a la voz, confuso', D: 'Solo responde al dolor', N: 'No responde'};
function pintaPanelBaja() {
  const st = SIM.st, b = bajaAct(st), v = vitales(b), m = SIM.med[b.id] || {};
  const visto = [];
  if (b.muerto) visto.push(t('Sin signos de vida.'));
  else {
    visto.push(t(ASPECTO[v.avdn]));
    const sang = b.fuentes.filter(f => f.tipo !== 'int' && f.rate * (1 - f.ctl) > 15); if (sang.length) visto.push(t('Sangrado visible: {0}', sang.map(f => L(f.zona)).join(', ')));
    if ((b.neumo && b.neumo.sev > .3) || b.via?.obs || b.depresion) visto.push(t('Respira con dificultad'));
    if (b.temp < 35.5) visto.push(t('Tirita, piel fría')); if (b.quem && !b.quem.cubierto) visto.push(t('Quemaduras extensas al descubierto'));
    if (b.nrbq && b.nrbq.sev > .2) visto.push(t('Babea, fasciculaciones, pupilas puntiformes'));
    b.fuentes.filter(f => f.tqs).forEach(f => visto.push(t('Torniquete en {0}{1}', L(f.zona), f.marcado ? ' ✓🕒' : ' — ' + t('sin hora marcada'))));
  }
  const fila = (n, k, u = '') => m[k] ? `<tr><th>${esc(t(n))}</th><td><b>${esc(String(m[k].v))}</b>${u} <small class="muted">${esc(t('hace {0}', mmss(st.t - m[k].t)))}</small></td></tr>` : '';
  const tab = fila('Pulso', 'fc', ' lpm') + fila('Pulso radial', 'radial') + fila('Tensión arterial', 'tas', ' mmHg') + fila('SpO₂', 'spo2', ' %') + fila('Frec. respiratoria', 'fr', ' rpm') + fila('Glasgow / AVDN', 'gcs') + fila('Pupilas', 'pup') + fila('Temperatura', 'temp', ' °C') + fila('Dolor', 'dolor', '/10');
  $('panelBaja').innerHTML = `<h3>${esc(b.id)} · ${esc(L(b.nombre))}</h3><p class="sc-les">${esc(L(b.lesion))}</p><ul class="sc-ul">${visto.map(x => `<li>${esc(x)}</li>`).join('')}</ul><h4 class="sc-fase">${esc(t('Lo que has medido'))}</h4>${tab ? `<table class="sc-vit">${tab}</table>` : `<p class="help">${esc(t('Aún nada. Las constantes solo aparecen cuando las mides («compruebo el pulso», «saturación»…).'))}</p>`}`;
}
/* guarda lo medido para el monitor */
function anotaMedida(id, b) {
  const v = vitales(b), m = SIM.med[b.id] = SIM.med[b.id] || {}, now = SIM.st.t, put = (k, val) => m[k] = {v: val, t: now};
  if (id === 'pulso') { put('fc', v.fc); put('radial', v.radial ? t('presente') : t('ausente')); }
  if (id === 'tension') put('tas', v.tas + '/' + Math.round(v.tas * .62));
  if (id === 'spo2') put('spo2', v.spo2);
  if (id === 'fr') put('fr', v.fr);
  if (id === 'glasgow') put('gcs', v.gcs + ' · ' + v.avdn);
  if (id === 'pupilas') put('pup', t(v.pupilas));
  if (id === 'temp') put('temp', v.temp);
  if (id === 'dolor') put('dolor', v.dolor);
  if (id === 'reevaluar') { put('fc', v.fc); put('tas', v.tas + '/' + Math.round(v.tas * .62)); put('spo2', v.spo2); put('gcs', v.gcs + ' · ' + v.avdn); }
}
/* mensajes de la conversación */
const ROL_TXT = {tu: 'Tú', sistema: 'Simulador', baja: 'Baja', instructor: 'Instructor', radio: 'Radio', ia: 'IA'};
function msg(rol, texto, hablar = false, quien = '') {
  const d = document.createElement('div'); d.className = 'sc-m sc-' + rol;
  d.innerHTML = `<span class="sc-who">${esc(t(ROL_TXT[rol]))}${quien ? ' · ' + esc(quien) : ''} <small>${SIM.st ? mmss(SIM.st.t) : ''}</small></span>${esc(texto)}`;
  $('log').appendChild(d); $('log').scrollTop = $('log').scrollHeight;
  if (rol !== 'tu') SIM.ultimo = texto;
  if (hablar) VOZ.di(texto, rol === 'tu' ? 'sistema' : rol === 'ia' ? 'instructor' : rol);
}

/* ── lo que dice el combatiente ── */
let ocupadoIA = false;
async function procesaFrase(alts) {
  if (!SIM.run) return; alts = (Array.isArray(alts) ? alts : [alts]).map(s => String(s).trim()).filter(Boolean); if (!alts.length) return;
  const tx = alts[0]; msg('tu', tx); $('sug').innerHTML = ''; $('brief').open = false;
  if (SIM.form) return rellenaForm(tx);
  const me = meta(tx, LANG);
  if (me.fin) return finaliza();
  if (me.repite) return VOZ.di(SIM.ultimo, 'sistema');
  if (me.opcion && SIM.decPend) return responde(me.opcion);
  if (me.baja != null && me.baja < SIM.st.bajas.length) { SIM.st.act = me.baja; msg('sistema', t('Atiendes a {0}.', SIM.st.bajas[me.baja].id)); refresca(); if (!interpreta(tx, LANG).length) return; }
  if (me.estado) { const b = bajaAct(SIM.st); msg('sistema', t(ASPECTO[vitales(b).avdn]) + '. ' + L(b.lesion), true); return; }
  if (SIM.decPend) { msg('sistema', t('Primero responde a la decisión: di «opción A», «opción B»…'), true); return; }
  let ids = []; for (const a of alts) { ids = interpreta(a, LANG); if (ids.length) break; }
  if (!ids.length) {
    if (SIM.ia && !ocupadoIA) return iaInterpreta(tx);
    msg('sistema', t('No he reconocido ninguna orden. Prueba con otras palabras o elige una sugerencia.'), true);
    return sugiere(tx);
  }
  for (const id of ids) ordena(id, tx);
}
function ordena(id, frase = '') {
  const st = SIM.st, b = bajaAct(st);
  if (id === 'medevac' && st.sinRadio > st.t) { msg('radio', t('… (sin enlace de radio) …'), true); st.log.push({t: Math.round(st.t), a: id, b: b.id, fase: st.fase, ok: false}); return; }
  const r = ejecuta(st, id, {frase});
  if (r.fuera) { msg('sistema', fmt(r.k, r.a), true); refresca(); return; }
  if (r.form) return abreForm(r.form);
  anotaMedida(id, b);
  msg('sistema', `${nomAcc(id)}: ${fmt(r.k, r.a)}`, !!r.voz || r.ok === false);
  const v = vitales(b);
  if (r.ok !== false && ['tq', 'tq2', 'empaquetar', 'tqunion', 'ncd', 'cric', 'io'].includes(id) && v.avdn === 'A') { SIM.tVoz[b.id] = st.t; msg('baja', t('¡Aaah! ¡Cómo duele!'), true, b.id); }
  revisaEventos(); refresca();
  if (b.muerto && !st.bajas.some(x => !x.expectante && !x.muerto)) finaliza();
}
/* sugerencias: órdenes de tu nivel que más palabras comparten con lo dicho */
function sugiere(tx) {
  const w = new Set(normz(tx).split(' ').filter(x => x.length > 3));
  const sc = ACC_IDS.filter(id => ACC[id].min <= NIV[S.nivel]).map(id => [id, L(ACC[id].k).split('|').reduce((s, k) => s + normz(k).split(' ').filter(x => w.has(x) || [...w].some(y => y.slice(0, 5) === x.slice(0, 5))).length, 0)]).sort((a, b) => b[1] - a[1]);
  const top = sc.filter(x => x[1] > 0).slice(0, 4).map(x => x[0]); const base = ['barrido', 'tq', 'reevaluar', 'pulso'].filter(x => !top.includes(x));
  $('sug').innerHTML = `<span class="help">${esc(t('¿Quisiste decir…?'))}</span> ` + [...top, ...base].slice(0, 5).map(id => `<button type="button" class="btn btn-ghost btn-sm" data-sug="${id}">${esc(nomAcc(id))}</button>`).join('');
  $$('#sug [data-sug]').forEach(b => b.onclick = () => { $('sug').innerHTML = ''; msg('tu', nomAcc(b.dataset.sug)); ordena(b.dataset.sug, nomAcc(b.dataset.sug)); });
}
/* entrada por teclado y por voz */
$('btnOrden').onclick = () => { const v = $('orden').value.trim(); if (!v) return; $('orden').value = ''; procesaFrase([v]); };
$('orden').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btnOrden').click(); } });
VOZ.onFrase = alts => { if (step === 2) procesaFrase(alts); };
VOZ.onParcial = p => { $('parcial').textContent = p ? '… ' + p : ''; };
VOZ.onEstado = (e, m) => { $('mic').setAttribute('aria-pressed', String(VOZ.escuchando)); $('mic').classList.toggle('on', VOZ.escuchando); if (m) { toast(t(m), 8000); $('chkManos').checked = false; } if (step === 2) pintaHud(); };
$('mic').onclick = () => { if (!VOZ.disponible()) return toast(t('Tu navegador no reconoce voz (Firefox no lo permite). Usa Chrome, Edge o Safari, o escribe las órdenes.'), 8000); VOZ.calla(); VOZ.alterna(); };
$('chkManos').onchange = e => { if (!VOZ.disponible()) { e.target.checked = false; return toast(t('Tu navegador no reconoce voz (Firefox no lo permite). Usa Chrome, Edge o Safari, o escribe las órdenes.'), 8000); } VOZ.manosLibres(e.target.checked); };
let _esp = false;
document.addEventListener('keydown', e => { if (step !== 2 || e.code !== 'Space' || e.repeat || /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName)) return; e.preventDefault(); if (!_esp && VOZ.disponible()) { _esp = true; VOZ.calla(); VOZ.inicia(); } });
document.addEventListener('keyup', e => { if (e.code === 'Space' && _esp) { _esp = false; try { VOZ.rec?.stop(); } catch {} } });
$('btnPausa').onclick = () => { SIM.pausa = !SIM.pausa; $('btnPausa').querySelector('span').textContent = SIM.pausa ? t('Reanudar') : t('Pausa'); pintaHud(); };
$('btnFin').onclick = () => finaliza();

/* ── formularios por radio (9 líneas, MIST): cada respuesta hablada rellena la línea en curso ── */
function abreForm(tipo) {
  const campos = tipo === 'medevac' ? LINEAS9 : MIST, b = bajaAct(SIM.st);
  SIM.form = {tipo, i: 0, r: {}, campos, b: SIM.st.act};
  msg('radio', tipo === 'medevac' ? t('Aquí MEDEVAC, adelante con su petición de 9 líneas.') : t('Recibido, adelante con su MIST de {0}.', b.id), true);
  pideCampo(); pintaForm();
}
function pideCampo() { const f = SIM.form; msg('radio', L(f.campos[f.i].n), true); }
function rellenaForm(tx) {
  const f = SIM.form, s = normz(tx);
  if (/^(cancelar|cancela|cancel|cancelar formulario)$/.test(s)) { SIM.form = null; msg('radio', t('Petición cancelada.'), true); return refresca(); }
  if (/^(anterior|atras|back|previous)$/.test(s)) { f.i = Math.max(0, f.i - 1); pideCampo(); return pintaForm(); }
  f.r[f.campos[f.i].k] = tx; f.i++;
  if (f.i >= f.campos.length) return cierraForm(); pideCampo(); pintaForm();
}
function cierraForm() {
  const f = SIM.form, st = SIM.st, e = SIM.esc;
  const val = f.tipo === 'medevac' ? valida9(st, e, f.r) : validaMist(st, e, f.r, f.b);
  st.form[f.tipo] = {fin: true, r: f.r, val, b: st.bajas[f.b].id};
  st.log.push({t: Math.round(st.t), a: f.tipo, b: st.bajas[f.b].id, fase: st.fase, ok: Object.values(val).every(v => v[0])});
  const malos = Object.entries(val).filter(([, v]) => !v[0]);
  msg('radio', malos.length ? t('Recibido. Revise: {0}.', malos.map(([k, v]) => k.toUpperCase() + ' — ' + fmtVal(v)).join(' · ')) : t('Recibido, todo correcto. Fin.'), true);
  SIM.form = null; refresca();
}
const fmtVal = v => fmt(v[1], (v[2] || []).map(x => Array.isArray(x) ? x.join(', ') : x));
function pintaForm() {
  const f = SIM.form, p = $('panelForm'); p.hidden = !f; if (!f) return;
  p.innerHTML = `<h3>📻 ${esc(f.tipo === 'medevac' ? t('Petición de evacuación (9 líneas)') : t('Informe MIST'))} <span class="fa-chip aviso">${esc(t('el reloj se detiene'))}</span></h3><ol class="sc-ul">${f.campos.map((c, i) => `<li class="${i === f.i ? 'sc-act' : ''}">${esc(L(c.n))}${f.r[c.k] ? ': <b>' + esc(f.r[c.k]) + '</b>' : ''}</li>`).join('')}</ol><p class="help">${esc(t('Di la respuesta de la línea marcada. «Anterior» vuelve atrás; «cancelar» la anula.'))}</p><div class="actions"><button class="btn btn-ghost btn-sm" id="fAnt" type="button">${esc(t('Anterior'))}</button><button class="btn btn-ghost btn-sm" id="fCan" type="button">${esc(t('Cancelar'))}</button></div>`;
  $('fAnt').onclick = () => rellenaForm('anterior'); $('fCan').onclick = () => rellenaForm('cancelar');
}

/* ── IA (opcional): traduce una frase libre a órdenes del catálogo. El código valida los identificadores ── */
function pideEnvio(textoEnviado) {
  if (ENVIO_OK) return Promise.resolve(true);
  $('envioInfo').innerHTML = `<p class="sub" style="margin-top:0">${esc(t('Se enviarán unos {0} caracteres a {1}: tu frase, el estado de la baja simulada y el catálogo de órdenes. No se envía tu seudónimo.', nf(textoEnviado.length), PROV[getProv()].n))}</p><p class="help">${esc(t('Muestra del envío:'))}</p>`;
  $('envioTxt').textContent = textoEnviado.slice(0, 2500) + (textoEnviado.length > 2500 ? '\n…' : '');
  $('envioOk').checked = false; $('envioSi').disabled = true; $('mEnvio').classList.add('on'); SIM.pausa = true;
  return new Promise(r => { envioRes = r; });
}
let envioRes = null;
function cierraEnvio(v) { $('mEnvio').classList.remove('on'); SIM.pausa = false; if (envioRes) { const r = envioRes; envioRes = null; if (v) ENVIO_OK = true; r(v); } }
_cierres.mEnvio = () => cierraEnvio(false);
$('envioOk').onchange = () => { $('envioSi').disabled = !$('envioOk').checked; };
$('envioSi').onclick = () => cierraEnvio(true); $('envioNo').onclick = () => cierraEnvio(false);
const catalogo = () => ACC_IDS.map(id => `${id}: ${tx3(ACC[id].n, 'es')}`).join('\n');
async function iaInterpreta(tx) {
  const st = SIM.st, b = bajaAct(st), v = vitales(b);
  const prompt = `Eres el motor de interpretación de un simulador de atención táctica a bajas. El combatiente (nivel ${S.nivel}) ha dicho: «${tx}».
Tarea 1: si la frase pide una o varias acciones, devuelve sus identificadores EXACTOS de este catálogo (no inventes otros):
${catalogo()}
Tarea 2: si la frase es una pregunta o comentario a la baja, responde en una frase breve como lo haría la baja, coherente con su estado. No inventes hallazgos clínicos que no estén en el estado.
Estado de la baja (no lo contradigas): lesión: ${tx3(b.lesion, 'es')}; conciencia: ${v.avdn}; dolor ${v.dolor}/10; ${b.muerto ? 'sin signos de vida' : 'viva'}.
Devuelve SOLO este JSON: {"acciones":["id"],"respuesta":"texto o vacío","rol":"baja|instructor"}
${INSTR_IDIOMA()}`;
  if (!(await pideEnvio(prompt))) return sugiere(tx);
  ocupadoIA = true; const marca = document.createElement('div'); marca.className = 'sc-m sc-sistema'; marca.innerHTML = '<span class="spin"></span> ' + esc(t('Consultando a tu IA…')); $('log').appendChild(marca);
  try {
    const j = await llmJSON([{role: 'system', content: 'Respondes SOLO con JSON válido.'}, {role: 'user', content: prompt}], {max: 400});
    marca.remove();
    const ids = [...new Set((j.acciones || []).map(String))].filter(id => ACC[id]); const inval = (j.acciones || []).filter(id => !ACC[id]);
    if (j.respuesta) msg(j.rol === 'instructor' ? 'instructor' : 'baja', String(j.respuesta).slice(0, 300), true, j.rol === 'instructor' ? '' : b.id);
    if (inval.length) msg('sistema', t('La IA propuso órdenes que no existen en el catálogo y se han descartado: {0}.', inval.join(', ')));
    if (ids.length) { msg('ia', t('Interpretado por la IA como: {0}.', ids.map(nomAcc).join(', '))); ids.forEach(id => ordena(id, tx)); }
    else if (!j.respuesta) { msg('sistema', t('No he reconocido ninguna orden. Prueba con otras palabras o elige una sugerencia.'), true); sugiere(tx); }
  } catch (e) { marca.remove(); msg('sistema', e.message); sugiere(tx); }
  finally { ocupadoIA = false; }
}

/* ── fin y debriefing ── */
function finaliza() {
  if (!SIM.run) return; SIM.run = false; paraReloj(); VOZ.para(); $('chkManos').checked = false; SIM.decPend = null; SIM.form = null;
  const st = SIM.st, e = SIM.esc, r = rubrica(st, e);
  const R = {app: APP, version: VERSION, alias: S.alias || t('anónimo'), codigo: `${e.id}.${S.nivel}.${S.vel}`, esc: e.id, nivel: S.nivel, fecha: new Date().toISOString(), dur: Math.round(st.t), demo: SIM.demo,
    pct: r.pct, pts: r.pts, max: r.max, apto: r.apto, fallosCrit: r.fallosCrit, items: r.items.map(i => ({id: i.id, ok: i.ok, crit: i.crit})),
    log: st.log.map(l => ({t: l.t, a: l.a, b: l.b, ok: l.ok !== false, fuera: !!l.fuera, cod: l.cod || null, fase: l.fase, n: l.n ?? null})),
    bajas: st.bajas.map(b => ({id: b.id, muerto: b.muerto, causa: b.causa, cat: b.cat, catOk: b.catOk, vit: vitales(b)})), forms: Object.fromEntries(Object.entries(st.form).map(([k, f]) => [k, {r: f.r, val: f.val, b: f.b}])), dec: st.dec};
  S.ult = R; if (!SIM.demo) S.hist = [...S.hist, {esc: R.esc, nivel: R.nivel, pct: R.pct, apto: R.apto, fecha: R.fecha, fallos: R.items.filter(i => !i.ok).map(i => i.id)}].slice(-200);
  SIM.demo = false; guardaYa(); $('iaDebTxt').innerHTML = ''; go(3);
}
const itemTxt = (e, id) => { const it = [...e.rub, {id: 'g_vivo', txt: L3('Todas las bajas recuperables siguen vivas al final', 'All salvageable casualties are alive at the end', 'Todos os feridos recuperáveis estão vivos no final')}, {id: 'g_alcance', txt: L3('Ninguna acción fuera del alcance de tu nivel', 'No action outside your level\'s scope', 'Nenhuma ação fora do alcance do seu nível')}].find(x => x.id === id); return it ? L(it.txt) : id; };
const nomLog = a => ACC[a] ? nomAcc(a) : a.startsWith('_dec_') ? t('Decisión {0}', a.slice(5)) : a.startsWith('_iny_') ? t('Inyección del instructor: {0}', t(NOM_INY[a.slice(5)] || a.slice(5))) : a === '_herido' ? t('El sanitario recibe un impacto') : a;
const COD_TXT = {sin_ind: 'sin indicación', tq_union: 'torniquete en la unión', sin_acceso: 'sin vía IV/IO', crist_mal: 'cristaloide en hemorragia no compresible', mal_med: 'fármaco inadecuado', conv_mal: 'conversión inoportuna', tbsa_mal: 'estimación errónea', regla10_mal: 'ritmo erróneo', falta_dato: 'falta el dato', rcp: 'RCP'};
function pintaDebrief() {
  const R = S.ult; if (!R) { $('debrief').innerHTML = `<div class="card"><p class="empty">${esc(t('Aún no has hecho ninguna simulación.'))}</p></div>`; return; }
  const e = escDe(R.esc);
  const forms = Object.entries(R.forms || {}).map(([k, f]) => `<h4 class="sc-fase">${esc(k === 'medevac' ? t('Petición de evacuación (9 líneas)') : t('Informe MIST') + ' · ' + f.b)}</h4><ul class="sc-ul">${Object.entries(f.val).map(([c, v]) => `<li>${v[0] ? '✓' : '⚠'} <b>${esc(c.toUpperCase())}</b> «${esc(f.r[c] || '')}» — ${esc(fmtVal(v))}</li>`).join('')}</ul>`).join('');
  $('debrief').innerHTML = `<div class="card sc-nota ${R.apto ? 'ok' : 'ko'}"><div><span class="sc-big">${R.pct} %</span><b>${R.apto ? esc(t('APTO')) : esc(t('NO APTO'))}</b></div><p>${esc(L(e.tit))} · ${esc(L(e.sub))} · ${esc(t('nivel {0}', R.nivel))} · ${mmss(R.dur)} · ${esc(R.alias)}${R.demo ? ' · ' + esc(t('ejemplo automático')) : ''}</p><p>${esc(t('{0} de {1} puntos · {2} fallo(s) crítico(s). Se necesita un 70 % y ningún fallo crítico.', R.pts, R.max, R.fallosCrit))}</p></div>
  <div class="card"><h3>${esc(t('Rúbrica'))}</h3><div class="table-wrap"><table><thead><tr><th></th><th>${esc(t('Punto'))}</th></tr></thead><tbody>${R.items.map(i => `<tr><td>${i.ok ? '✓' : '✗'}</td><td>${esc(itemTxt(e, i.id))}${i.crit ? ` <span class="fa-chip error">${esc(t('crítico'))}</span>` : ''}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>${esc(t('Estado final de las bajas'))}</h3><ul class="sc-ul">${R.bajas.map(b => `<li><b>${esc(b.id)}</b>: ${b.muerto ? esc(t('fallecida ({0})', t(b.causa || ''))) : esc(t('viva · FC {0} · TAS {1} · SpO₂ {2} % · {3} · {4} °C', b.vit.fc, b.vit.tas, b.vit.spo2, b.vit.avdn, b.vit.temp))}${b.catOk ? ' · ' + esc(t('triaje: {0} (correcto: {1})', b.cat ? t(b.cat.toUpperCase()) : '—', t(b.catOk.toUpperCase()))) : ''}</li>`).join('')}</ul>${forms}</div>
  <div class="card"><h3>${esc(t('Línea de tiempo'))}</h3><div class="table-wrap"><table><thead><tr><th>${esc(t('Tiempo'))}</th><th>${esc(t('Orden'))}</th><th>${esc(t('Baja'))}</th><th>${esc(t('Observación'))}</th></tr></thead><tbody>${R.log.map(l => `<tr><td>${mmss(l.t)}</td><td>${esc(nomLog(l.a))}${l.n ? ' · ' + esc(String(l.n).toUpperCase()) : ''}</td><td>${esc(l.b)}</td><td>${l.fuera ? `<span class="fa-chip error">${esc(t('fuera de tu nivel'))}</span>` : ''}${l.cod ? `<span class="fa-chip aviso">${esc(t(COD_TXT[l.cod] || l.cod))}</span>` : ''}${l.fase === 'cuf' ? ` <span class="fa-chip">${esc(t('bajo fuego'))}</span>` : ''}${!l.ok && !l.fuera && !l.cod ? `<span class="fa-chip aviso">${esc(t('sin efecto'))}</span>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('iaDeb').hidden = false;
}
$('btnRepetir').onclick = () => { if (S.ult) { S.esc = S.ult.esc; S.nivel = S.ult.nivel; } SIM.run = false; go(2); };
$('btnOtro').onclick = () => go(1);
/* comentario de la IA: solo consejos; cada consejo se ancla a un punto de la rúbrica y el código comprueba que ese punto existe en la sesión */
$('btnIADeb').onclick = async () => {
  const R = S.ult; if (!R) return; if (!pideClave()) return;
  const e = escDe(R.esc), ids = new Set(R.items.map(i => i.id));
  const prompt = `Eres instructor de atención táctica a bajas (TCCC). Escenario: ${tx3(e.tit, 'es')} (${tx3(e.sub, 'es')}). Nivel ${R.nivel}. Resultado calculado por código: ${R.pct} % (${R.apto ? 'APTO' : 'NO APTO'}).
Rúbrica (id · ok=logrado):
${R.items.map(i => `- ${i.id} [${i.ok ? 'ok' : 'NO'}${i.crit ? ', crítico' : ''}] ${itemTxt(e, i.id)}`).join('\n')}
Secuencia de órdenes (mm:ss, orden, baja, incidencia):
${R.log.map(l => `${mmss(l.t)} ${nomLog(l.a)} ${l.b}${l.fuera ? ' FUERA DE NIVEL' : ''}${l.cod ? ' ' + l.cod : ''}`).join('\n')}
Redacta de 3 a 6 consejos concretos y accionables para la próxima vez, centrados en lo NO logrado y en el orden de las acciones. No cambies ni discutas la nota. Cada consejo indica el id del punto de la rúbrica al que se refiere (uno de la lista y de ninguna otra).
Devuelve SOLO este JSON: {"consejos":[{"texto":"…","punto":"id"}]}
${INSTR_IDIOMA()}`;
  if (!(await pideEnvio(prompt))) return;
  $('iaDebTxt').innerHTML = '<p><span class="spin"></span> ' + esc(t('Consultando a tu IA…')) + '</p>';
  try {
    const j = await llmJSON([{role: 'system', content: 'Respondes SOLO con JSON válido.'}, {role: 'user', content: prompt}], {max: 1200});
    const cs = (j.consejos || []).map(c => ({texto: String(c.texto || ''), punto: String(c.punto || '').trim()})).filter(c => c.texto);
    R.ia = cs.map(c => ({...c, ok: ids.has(c.punto)})); guardaYa();
    $('iaDebTxt').innerHTML = pintaIA(R.ia, e);
  } catch (err) { $('iaDebTxt').innerHTML = `<p class="aviso">${esc(err.message)}</p>`; }
};
const pintaIA = (cs, e) => `<ul class="sc-ul">${cs.map(c => `<li>${esc(c.texto)} <small>${c.ok ? '✓ ' + esc(itemTxt(e, c.punto)) : '⚠ ' + esc(t('el punto «{0}» no existe en esta rúbrica: compruébalo', c.punto))}</small></li>`).join('')}</ul><p class="help">${esc(t('Redactado por la IA. No modifica la nota.'))}</p>`;
/* descargas */
function informeMd(R) {
  const e = escDe(R.esc);
  return `## ${t('Resultado')}\n**${R.pct} % · ${R.apto ? t('APTO') : t('NO APTO')}** — ${t('{0} de {1} puntos · {2} fallo(s) crítico(s). Se necesita un 70 % y ningún fallo crítico.', R.pts, R.max, R.fallosCrit)}\n\n${t('Escenario')}: ${L(e.tit)} (${L(e.sub)}) · ${t('nivel {0}', R.nivel)} · ${t('Tiempo')}: ${mmss(R.dur)} · ${t('Código de sesión')}: ${R.codigo}\n\n## ${t('Rúbrica')}\n${R.items.map(i => `- ${i.ok ? '✓' : '✗'} ${itemTxt(e, i.id)}${i.crit ? ' (' + t('crítico') + ')' : ''}`).join('\n')}\n\n## ${t('Estado final de las bajas')}\n${R.bajas.map(b => `- ${b.id}: ${b.muerto ? t('fallecida ({0})', t(b.causa || '')) : t('viva · FC {0} · TAS {1} · SpO₂ {2} % · {3} · {4} °C', b.vit.fc, b.vit.tas, b.vit.spo2, b.vit.avdn, b.vit.temp)}`).join('\n')}\n\n## ${t('Línea de tiempo')}\n${R.log.map(l => `- ${mmss(l.t)} · ${nomLog(l.a)} · ${l.b}${l.fuera ? ' · ' + t('fuera de tu nivel') : ''}${l.cod ? ' · ' + t(COD_TXT[l.cod] || l.cod) : ''}`).join('\n')}${R.ia ? `\n\n## ${t('Comentario del instructor (IA, opcional)')}\n${R.ia.map(c => `- ${c.texto}${c.ok ? '' : ' ⚠'}`).join('\n')}` : ''}`;
}
$('btnWord').onclick = async () => { const R = S.ult; if (!R) return toast(t('Aún no has hecho ninguna simulación.')); try { dl(`debriefing_${R.esc}_${R.nivel}.docx`, await wordDeMarkdown(informeMd(R), {titulo: APP_NAME + ' · ' + t('Debriefing'), subtitulo: `${R.alias} · ${new Date(R.fecha).toLocaleString(locale())}`, pie: t('Generado con {0} v{1}. Fisiología y rúbrica calculadas por código. Herramienta formativa: no aplicar a pacientes reales.', APP_NAME, VERSION)})); } catch (err) { toast(err.message, 7000); } };
$('btnJson').onclick = () => { const R = S.ult; if (!R) return toast(t('Aún no has hecho ninguna simulación.')); dl(`resultado_${slug(R.alias)}_${R.esc}_${R.nivel}.json`, JSON.stringify(R, null, 1), 'application/json'); };
$('btnCsv').onclick = () => { const R = S.ult; if (!R) return toast(t('Aún no has hecho ninguna simulación.')); dl(`registro_${R.esc}.csv`, csvDe([t('tiempo'), t('orden'), t('baja'), t('fase'), t('fuera de nivel'), t('incidencia')], R.log.map(l => [mmss(l.t), nomLog(l.a), l.b, l.fase, l.fuera ? t('sí') : t('no'), l.cod ? t(COD_TXT[l.cod] || l.cod) : ''])), 'text/csv;charset=utf-8'); };

/* ── sección: instructor ── */
function pintaInstr() {
  detenSim();
  $('iEsc').innerHTML = ESC.map(e => `<option value="${e.id}">${e.ico} ${esc(L(e.tit))} · ${esc(L(e.sub))}</option>`).join(''); $('iNiv').innerHTML = NIVELES.map(n => `<option value="${n}">${esc(t(NIV_TXT[n][0]))}</option>`).join('');
  $('iEsc').value = S.esc; $('iNiv').value = S.nivel; $('iVel').value = String(S.vel); codigoInstr(); pintaAgreg();
}
const codigoInstr = () => { $('iCodigo').textContent = `${$('iEsc').value}.${$('iNiv').value}.${$('iVel').value}`; };
['iEsc', 'iNiv', 'iVel'].forEach(id => $(id).onchange = codigoInstr);
const copia = async tx => { try { await navigator.clipboard.writeText(tx); toast(t('Copiado.')); } catch { toast(tx, 9000); } };
$('iCopiar').onclick = () => copia($('iCodigo').textContent);
$('iEnlace').onclick = () => copia(location.origin + location.pathname + '?s=' + encodeURIComponent($('iCodigo').textContent) + '&lang=' + LANG);
$('iFiles').onchange = async e => {
  let n = 0, mal = 0;
  for (const f of e.target.files) { try { const j = JSON.parse(await f.text()); if (j.app !== APP || !Array.isArray(j.items)) { mal++; continue; } const k = j.alias + '|' + j.fecha; if (!S.agreg.some(x => x.alias + '|' + x.fecha === k)) { S.agreg.push(j); n++; } } catch { mal++; } }
  e.target.value = ''; guardaYa(); pintaAgreg(); toast(t('{0} resultado(s) añadidos{1}.', n, mal ? ' · ' + t('{0} fichero(s) no válidos', mal) : ''));
};
function pintaAgreg() {
  const A = S.agreg; if (!A.length) { $('iTabla').innerHTML = `<p class="empty">${esc(t('Todavía no hay resultados.'))}</p>`; return; }
  const filas = A.map(r => `<tr><td>${esc(r.alias)}</td><td>${esc(L(escDe(r.esc).tit))}</td><td>${esc(r.nivel)}</td><td><b>${r.pct} %</b></td><td>${r.apto ? '✓' : '✗'}</td><td>${r.fallosCrit}</td><td>${esc(new Date(r.fecha).toLocaleDateString(locale()))}</td></tr>`).join('');
  const porItem = {}; A.forEach(r => r.items.forEach(i => { const k = r.esc + '|' + i.id; (porItem[k] = porItem[k] || {esc: r.esc, id: i.id, n: 0, ok: 0, crit: i.crit}); porItem[k].n++; if (i.ok) porItem[k].ok++; }));
  const dif = Object.values(porItem).sort((a, b) => a.ok / a.n - b.ok / b.n).slice(0, 12);
  $('iTabla').innerHTML = `<div class="table-wrap"><table><thead><tr><th>${esc(t('Seudónimo'))}</th><th>${esc(t('Escenario'))}</th><th>${esc(t('Nivel'))}</th><th>%</th><th>${esc(t('APTO'))}</th><th>${esc(t('Fallos críticos'))}</th><th>${esc(t('Fecha'))}</th></tr></thead><tbody>${filas}</tbody></table></div>
    <h4 class="sc-fase">${esc(t('Puntos que más cuestan al grupo'))}</h4><div class="table-wrap"><table><thead><tr><th>${esc(t('Punto'))}</th><th>${esc(t('Logrado'))}</th></tr></thead><tbody>${dif.map(d => `<tr><td>${esc(L(escDe(d.esc).tit))}: ${esc(itemTxt(escDe(d.esc), d.id))}${d.crit ? ` <span class="fa-chip error">${esc(t('crítico'))}</span>` : ''}</td><td>${Math.round(d.ok / d.n * 100)} % (${d.ok}/${d.n})</td></tr>`).join('')}</tbody></table></div>`;
}
$('iCsv').onclick = () => { if (!S.agreg.length) return toast(t('Todavía no hay resultados.')); dl('resumen_grupo.csv', csvDe([t('Seudónimo'), t('Escenario'), t('Nivel'), '%', t('APTO'), t('Fallos críticos'), t('Fecha'), t('Puntos no logrados')], S.agreg.map(r => [r.alias, L(escDe(r.esc).tit), r.nivel, r.pct, r.apto ? t('sí') : t('no'), r.fallosCrit, r.fecha, r.items.filter(i => !i.ok).map(i => itemTxt(escDe(r.esc), i.id)).join(' | ')])), 'text/csv;charset=utf-8'); };
$('iBorrar').onclick = () => { if (!confirm(t('¿Vaciar los resultados reunidos en este navegador?'))) return; S.agreg = []; guardaYa(); pintaAgreg(); };

/* ── sección: órdenes ── */
function pintaOrdenes() {
  detenSim();
  const q = normz($('ordBusca').value);
  const ids = ACC_IDS.filter(id => !q || normz(nomAcc(id) + ' ' + L(ACC[id].k)).includes(q));
  $('ordTabla').innerHTML = `<table><thead><tr><th>${esc(t('Orden'))}</th><th>${esc(t('Desde el nivel'))}</th><th>${esc(t('Puedes decir, por ejemplo'))}</th></tr></thead><tbody>${ids.map(id => `<tr><td><b>${esc(nomAcc(id))}</b><br><small class="muted">${esc(t(CATS[ACC[id].c]))}</small></td><td>${NIVELES[ACC[id].min]}</td><td>${L(ACC[id].k).split('|').slice(0, 4).map(k => '«' + esc(k.trim()) + '»').join(' · ')}</td></tr>`).join('')}</tbody></table>`;
}
$('ordBusca').oninput = pintaOrdenes;

/* ── sección: progreso ── */
function pintaProgreso() {
  detenSim();
  const H = S.hist; if (!H.length) { $('progreso').innerHTML = `<p class="empty">${esc(t('Aún no has hecho ninguna simulación.'))}</p>`; return; }
  const g = {}; H.forEach(h => { const k = h.esc + '|' + h.nivel; (g[k] = g[k] || {esc: h.esc, nivel: h.nivel, n: 0, mejor: 0, apto: false}); g[k].n++; g[k].mejor = Math.max(g[k].mejor, h.pct); g[k].apto = g[k].apto || h.apto; });
  const fallos = {}; H.forEach(h => (h.fallos || []).forEach(f => { const k = h.esc + '|' + f; fallos[k] = (fallos[k] || 0) + 1; }));
  const top = Object.entries(fallos).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $('progreso').innerHTML = `<div class="table-wrap"><table><thead><tr><th>${esc(t('Escenario'))}</th><th>${esc(t('Nivel'))}</th><th>${esc(t('Intentos'))}</th><th>${esc(t('Mejor'))}</th><th>${esc(t('APTO'))}</th></tr></thead><tbody>${Object.values(g).map(x => `<tr><td>${escDe(x.esc).ico} ${esc(L(escDe(x.esc).tit))}</td><td>${x.nivel}</td><td>${x.n}</td><td><b>${x.mejor} %</b></td><td>${x.apto ? '✓' : '—'}</td></tr>`).join('')}</tbody></table></div>${top.length ? `<h4 class="sc-fase">${esc(t('Lo que más se te resiste'))}</h4><ul class="sc-ul">${top.map(([k, n]) => { const [e, id] = k.split('|'); return `<li>${esc(L(escDe(e).tit))}: ${esc(itemTxt(escDe(e), id))} <small>(${n}×)</small></li>`; }).join('')}</ul>` : ''}`;
}
$('btnBorrarHist').onclick = () => { if (!confirm(t('¿Borrar todo tu historial de este navegador?'))) return; S.hist = []; S.ult = null; guardaYa(); pintaProgreso(); };

/* ── ejemplo automático (sin clave de IA): BajoFuego dicho por voz simulada ── */
const DEMO = {
  es: ['Opción A', 'Devuelvo fuego, me pongo a cubierto', 'Torniquete alto y apretado en el muslo', 'Lo arrastro a cubierto', 'Barrido de cabeza a pies', 'Segundo torniquete', 'Compruebo el pulso distal', 'Marco la hora del torniquete', 'Saturación', 'Manta térmica', 'Informo al mando', 'Fin de la simulación'],
  en: ['Option A', 'Return fire, take cover', 'Tourniquet high and tight on the thigh', 'Drag him to cover', 'Blood sweep head to toe', 'Second tourniquet', 'Check distal pulse', 'Mark the time on the tourniquet', 'Saturation', 'Hypothermia kit', 'Inform command', 'End simulation'],
  pt: ['Opção A', 'Respondo ao fogo, abrigo-me', 'Torniquete alto e apertado na coxa', 'Arrasto o ferido para abrigo', 'Varrimento da cabeça aos pés', 'Segundo torniquete', 'Verifico o pulso distal', 'Marco a hora do torniquete', 'Saturação', 'Manta térmica', 'Informo o comando', 'Fim da simulação']
};
async function demo() {
  S.esc = 'cuf'; S.nivel = 'CMC'; SIM.run = false; SIM.demo = true; go(2); toast(t('Ejemplo automático: escucha cómo se dan las órdenes. No usa la IA.'), 6000);
  for (const f of DEMO[LANG] || DEMO.es) {
    await sleep(2200); if (!SIM.run || !SIM.demo) return;
    $('orden').value = f; await sleep(500); $('orden').value = ''; window.simulaVoz(f);
  }
}

/* ── arranque ── */
(async () => {
  const p = await cargaEstado(); if (p) S = {...S, ...p};
  iniciaUI(); VOZ.hablaOn = S.habla;
  window.addEventListener('langchange', () => { if (step === 2 && SIM.st) SIM.st.lang = LANG; });
  const q = new URLSearchParams(location.search).get('s');
  if (q && aplicaCodigo(q)) { toast(t('Sesión cargada: {0}, nivel {1}.', L(escDe(S.esc).tit), S.nivel), 6000); go(1); } else go(0);
})();
