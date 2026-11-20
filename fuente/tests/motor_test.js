/* Pruebas de la lógica pura (sin navegador): node tests/motor_test.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['motor.js', 'escenarios.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8').replace(/if \(typeof module[^\n]*\n?$/m, '')).join('\n');
const ctx = {console}; vm.createContext(ctx); vm.runInContext(src + '\n;this.M={ACC,interpreta,meta,numeros,nuevaSesion,ejecuta,tick,rubrica,valida9,validaMist,inyecta,vitales,ESC,escDe,pretratar,controlFuego};', ctx);
const M = ctx.M; let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('  ✗ ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

console.log('1) Reconocimiento de órdenes');
eq(M.interpreta('Pongo un torniquete alto y apretado en la pierna', 'es'), ['tq'], 'es torniquete');
eq(M.interpreta('segundo torniquete y marco la hora', 'es'), ['tq2', 'marcar'], 'es segundo + marcar');
eq(M.interpreta('descomprimo el neumotórax a tensión', 'es'), ['ncd'], 'es «tensión» no dispara la TA');
eq(M.interpreta('Apply a tourniquet high and tight, then check distal pulse', 'en'), ['tq', 'pulsodistal'], 'en');
eq(M.interpreta('coloco um selo torácico e verifico a saturação', 'pt'), ['sello', 'spo2'], 'pt');
eq(M.interpreta('canalizo una vía intraósea y pongo ácido tranexámico', 'es'), ['io', 'txa'], 'es io+txa (la «vía» no dispara IV)');
eq(M.interpreta('busco sangre en el suelo', 'es'), [], 'es «sangre» suelta no transfunde');
eq(M.interpreta('Lo arrastro a cubierto', 'es'), ['mover'], 'es arrastrar a cubierto no es devolver fuego');
eq(M.interpreta('Arrasto o ferido para abrigo', 'pt'), ['mover'], 'pt arrastar para abrigo');
eq(M.interpreta('Compruebo el pulso distal', 'es'), ['pulsodistal'], 'es pulso distal');
eq(M.interpreta('Verifico o pulso distal', 'pt'), ['pulsodistal'], 'pt pulso distal');
for (const l of ['es', 'en', 'pt']) for (const f of {es: ['Devuelvo fuego, me pongo a cubierto'], en: ['Return fire, take cover'], pt: ['Respondo ao fogo, abrigo-me']}[l]) eq(M.interpreta(f, l)[0], 'fuego', l + ' devolver fuego');
eq(M.meta('paso a la baja dos', 'es').baja, 1, 'meta baja dos');
eq(M.meta('option bravo', 'en').opcion, 'b', 'meta opción');
eq(M.meta('B', 'es').opcion, 'b', 'meta letra sola');
eq(M.numeros('regla de los nueves, treinta y cinco por ciento'), [35], 'números en palabras');

{ let n = 0, mal = [];
  for (const id of Object.keys(M.ACC)) for (const l of ['es', 'en', 'pt']) for (const k of M.ACC[id].k[l].split('|')) { const r = M.interpreta(k, l); n++; if (r[0] !== id) mal.push(`${l} «${k.trim()}» → ${r.join(',') || '∅'} (esperado ${id})`); }
  ok(!mal.length, `cada frase de ejemplo se reconoce como su orden (${n} frases): ` + mal.slice(0, 12).join(' · ')); }
console.log('2) Fisiología');
{ const e = M.escDe('cuf'), st = M.nuevaSesion(e, 'CMC'); M.tick(st, 600); ok(st.bajas[0].muerto, 'sin tratar, la baja de BajoFuego muere en 10 min'); }
{ const e = M.escDe('cuf'), st = M.nuevaSesion(e, 'CMC'); M.ejecuta(st, 'fuego'); M.ejecuta(st, 'tq'); M.ejecuta(st, 'tq2'); M.tick(st, 600); ok(!st.bajas[0].muerto, 'con dos torniquetes sobrevive'); }
{ const e = M.escDe('torax'), st = M.nuevaSesion(e, 'CMC'); M.ejecuta(st, 'sello'); M.tick(st, 130); ok(M.vitales(st.bajas[0]).spo2 < 80, 'tras sellar aparece el neumotórax a tensión'); M.ejecuta(st, 'ncd'); ok(M.vitales(st.bajas[0]).spo2 > 90, 'la descompresión lo resuelve'); }
{ const e = M.escDe('cuf'), st = M.nuevaSesion(e, 'ASM'); const r = M.ejecuta(st, 'iv'); ok(r.fuera, 'ASM no puede canalizar'); }

console.log('3) Formularios por radio');
{ const e = M.escDe('evac'), st = M.nuevaSesion(e, 'CLS'); M.pretratar(st, e);
  const v = M.valida9(st, e, {l1: '30S YH 1234 5678', l2: 'Halcón 2, 45.250', l3: 'A uno, B uno, C cero', l4: 'A ninguno', l5: 'L dos, A cero', l6: 'P', l7: 'C humo verde', l8: 'A', l9: 'ninguna'});
  ok(Object.values(v).every(x => x[0]), '9 líneas correctas: ' + JSON.stringify(Object.entries(v).filter(([, x]) => !x[0])));
  const m = M.valida9(st, e, {l3: 'A dos', l5: 'L uno', l6: 'N', l9: 'química'}); ok(!m.l3[0] && !m.l5[0] && !m.l6[0] && !m.l9[0], 'detecta líneas incorrectas'); }
{ const e = M.escDe('informe'), st = M.nuevaSesion(e, 'CMC'); M.pretratar(st, e);
  const bien = M.validaMist(st, e, {M: 'Herida por arma de fuego hace 20 minutos', I: 'Herida en el brazo derecho', S: 'Pulso 110, respira 20, saturación 97', T: 'torniquete, intraósea y ácido tranexámico'});
  ok(Object.values(bien).every(x => x[0]), 'MIST coherente: ' + JSON.stringify(bien.T));
  const mal = M.validaMist(st, e, {M: 'caída', I: 'pierna', S: 'bien', T: 'torniquete y cricotiroidotomía'});
  ok(!mal.M[0] && !mal.S[0] && !mal.T[0] && mal.T[3].sobra.includes('cric') && mal.T[3].falta.includes('io'), 'MIST: detecta lo inventado y lo omitido'); }

console.log('4) Recorridos por escenario (ideal debe ser APTO; vacío no)');
const IDEAL = {
  cuf: [['d', 'd1', 'a'], 'fuego', 'tq', 'mover', 'barrido', 'tq2', 'pulsodistal', 'marcar', 'hpmk', 'c2', ['w', 400], 'reevaluar', 'tq', 'reevaluar'],
  hem: ['barrido', 'tq', 'marcar', 'pulsodistal', 'empaquetar', 'presion', 'iv', 'txa', 'pulso', 'hpmk', 'c2', ['w', 420], 'reevaluar', 'empaquetar', 'presion', 'reevaluar'],
  via: ['barrido', 'frente', 'npa', 'cric', 'spo2', 'hpmk', 'c2'],
  torax: ['barrido', 'torax', 'spo2', 'sello', 'fr', ['w', 120], 'spo2', 'ncd', 'spo2', 'digital', 'hpmk'],
  shock: ['tq', ['b', 0], 'tq', 'pelvica', 'pulso', 'io', 'txa', 'sangre', 'sangre', 'calcio', 'hpmk', 'ketamina', 'medevac9'],
  tce: ['presion', 'hpmk', 'glasgow', 'pupilas', 'spo2', 'oxigeno', 'collarin', 'cabeza30', 'desarmar', 'iv', ['w', 300], 'glasgow', 'pupilas', 'hipertonico', 'c2'],
  triaje: [['d', 'd1', 'a'], ['b', 1], 'urgente', 'tq', 'tq2', ['b', 0], 'rutina', ['b', 2], 'expectante', ['b', 3], 'prioritario', 'ferula', ['b', 1], 'reevaluar', ['b', 2], 'confort', 'medevac9', 'c2'],
  evac: [['d', 'd1', 'a'], 'camilla', ['b', 1], 'camilla', ['b', 0], ['w', 160], 'reevaluar', 'torax', 'ncd', 'medevac9', 'mist', 'tarjeta', 'relevo'],
  informe: ['controlmed', ['d', 'd1', 'a'], 'pulso', 'fr', 'spo2', 'glasgow', 'reevaluar', 'tarjeta', 'mist', 'relevo'],
  analgesia: ['dolor', 'cwpp', 'dolor', ['b', 1], 'dolor', 'ferula', 'otfc', 'fr', 'ondansetron'],
  quem: ['apagar', 'barrido', 'spo2', 'oxigeno', ['tbsa', 'regla de los nueves, 35 por ciento'], 'aposito', 'hpmk', 'io', ['regla10', 'regla del diez, 360 ml hora'], 'ketamina', 'c2'],
  blast: ['mace', 'oidos', 'observar', ['b', 1], 'mace', ['w', 200], 'spo2', 'torax', 'ncd', 'c2'],
  nrbq: ['mascara', 'tq', 'atnaa', 'atnaa', 'atnaa', 'cana', 'rsdl', 'bvm', 'urgente', 'hpmk', 'medevac9'],
  paliativo: [['d', 'd1', 'a'], ['b', 1], 'tq', 'tq2', ['b', 0], 'expectante', ['b', 2], 'rutina', ['b', 1], ['w', 280], 'reevaluar', 'tq', ['b', 0], 'confort', ['d', 'd2', 'a'], 'tarjeta'],
  etica: [['d', 'd1', 'a'], ['b', 1], 'tq', 'desarmar', ['b', 0], 'ferula', 'cwpp', 'controlmed', ['d', 'd2', 'a'], ['d', 'd3', 'a'], 'c2']
};
const R9 = {
  evac: {l1: '30S YH 1234 5678', l2: 'Halcón 2 45.250', l3: 'A uno B uno', l4: 'A', l5: 'L dos A cero', l6: 'P', l7: 'C', l8: 'A', l9: 'ninguna'},
  triaje: {l1: '1234 5678', l2: 'indicativo 2 frecuencia 45', l3: 'A uno B uno C uno', l4: 'A', l5: 'L dos A uno', l6: 'P', l7: 'C', l8: 'A', l9: 'ninguna'},
  nrbq: {l1: '1234 5678', l2: 'Lobo 1 40.1', l3: 'A uno', l4: 'A', l5: 'L uno', l6: 'E', l7: 'C', l8: 'A', l9: 'química'},
  shock: {l1: '1234 5678', l2: 'Lobo 1 40.1', l3: 'A uno', l4: 'A', l5: 'L uno', l6: 'P', l7: 'C', l8: 'A', l9: 'ninguna'}
};
const MISTS = {
  evac: {M: 'disparo hace 30 minutos', I: 'herida en el muslo y neumotorax', S: 'pulso 110 saturacion 95', T: 'torniquete y descompresion'},
  informe: {M: 'herida por arma de fuego', I: 'brazo derecho', S: 'pulso 100 respira 18', T: 'torniquete intraosea acido tranexamico'}
};
for (const e of M.ESC) {
  const nivel = e.id === 'analgesia' || e.id === 'quem' || e.id === 'shock' || e.id === 'via' || e.id === 'torax' || e.id === 'informe' || e.id === 'tce' || e.id === 'hem' || e.id === 'etica' ? 'CMC' : 'CMC';
  const st = M.nuevaSesion(e, nivel); M.pretratar(st, e);
  for (const p of IDEAL[e.id]) {
    if (Array.isArray(p)) {
      if (p[0] === 'd') st.dec[p[1]] = p[2]; else if (p[0] === 'b') st.act = p[1]; else if (p[0] === 'w') M.tick(st, p[1]); else M.ejecuta(st, p[0], {frase: p[1]});
    } else if (p === 'medevac9') { st.form.medevac = {fin: true, r: R9[e.id], val: M.valida9(st, e, R9[e.id])}; st.log.push({t: st.t, a: 'medevac', b: 'B1', ok: true}); }
    else if (p === 'mist') { st.form.mist = {fin: true, r: MISTS[e.id], val: M.validaMist(st, e, MISTS[e.id], 0)}; }
    else M.ejecuta(st, p);
  }
  M.tick(st, Math.max(0, e.dur - st.t));
  const r = M.rubrica(st, e);
  const f = r.items.filter(i => !i.ok).map(i => i.id);
  ok(r.apto, `${e.id} ideal → ${r.pct} % ${r.apto ? 'APTO' : 'NO APTO'}; fallan: ${f.join(', ')}${st.bajas.filter(b => b.muerto && !b.expectante).map(b => ' · muere ' + b.id + ' (' + b.causa + ')').join('')}`);
  const st2 = M.nuevaSesion(e, nivel); M.pretratar(st2, e); M.tick(st2, e.dur); const r2 = M.rubrica(st2, e);
  ok(!r2.apto, `${e.id} sin hacer nada debería ser NO APTO (${r2.pct} %)`);
  console.log(`  ${r.apto ? '✓' : '✗'} ${e.id.padEnd(10)} ideal ${String(r.pct).padStart(3)} % · vacío ${String(r2.pct).padStart(3)} % · ${r.items.length} puntos${f.length ? ' · no logrados: ' + f.join(', ') : ''}`);
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo correcto'); process.exit(fallos ? 1 : 0);
