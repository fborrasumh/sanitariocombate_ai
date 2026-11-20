/* ══ voz.js — voz hablada y transcrita POR EL NAVEGADOR (Web Speech API): sin coste de IA ══
   · Reconocimiento (SpeechRecognition): pulsar para hablar o manos libres. Chrome y Edge lo envían a los servidores de su
     fabricante (necesita red); Safari usa el reconocimiento de Apple; Firefox no lo tiene → se escribe.
   · Síntesis (speechSynthesis): la baja, el instructor y la radio hablan con voces distintas del propio sistema.
   · Mientras el simulador habla, el micrófono se pausa para que no se escuche a sí mismo. */
const VOZ_LOC = {es: 'es-ES', en: 'en-GB', pt: 'pt-PT'};
const ROLES = {baja: {pitch: .8, rate: 1.02}, instructor: {pitch: 1, rate: 1.08}, radio: {pitch: 1.25, rate: 1.18}, sistema: {pitch: 1, rate: 1.12}};
const VOZ = {
  SR: window.SpeechRecognition || window.webkitSpeechRecognition || null,
  rec: null, escuchando: false, manos: false, hablaOn: true, _pausaTTS: false, _cola: 0,
  onFrase: null, onParcial: null, onEstado: null,
  disponible() { return !!this.SR; },
  sintesis() { return 'speechSynthesis' in window; },
  _crea() {
    const r = new this.SR(); r.lang = VOZ_LOC[LANG] || 'es-ES'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = this.manos;
    r.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { const alts = [...res].map(a => a.transcript.trim()).filter(Boolean); if (alts.length) this._final(alts); }
        else this.onParcial?.(res[0].transcript);
      }
    };
    r.onerror = e => {
      const m = {'not-allowed': 'El navegador no tiene permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.', 'service-not-allowed': 'El navegador no tiene permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.', 'network': 'El reconocimiento de voz de este navegador necesita conexión a internet. Puedes seguir escribiendo las órdenes.', 'audio-capture': 'No se detecta ningún micrófono.', 'language-not-supported': 'Este navegador no reconoce voz en este idioma. Escribe las órdenes.'}[e.error];
      if (m) { this.manos = false; this.onEstado?.('error', m); }
    };
    r.onend = () => { this.escuchando = false; this.onEstado?.('fin'); if (this.manos && !this._pausaTTS) setTimeout(() => { if (this.manos && !this.escuchando && !this._pausaTTS) this.inicia(); }, 250); };
    return r;
  },
  _final(alts) { this.onParcial?.(''); this.onFrase?.(alts); },
  inicia() {
    if (!this.SR) { this.onEstado?.('error', 'Tu navegador no reconoce voz (Firefox no lo permite). Usa Chrome, Edge o Safari, o escribe las órdenes.'); return false; }
    if (this.escuchando) return true;
    try { this.rec = this._crea(); this.rec.start(); this.escuchando = true; this.onEstado?.('escucha'); return true; } catch (e) { this.escuchando = false; return false; }
  },
  para() { this.manos = false; try { this.rec?.stop(); } catch {} this.escuchando = false; this.onEstado?.('fin'); },
  alterna() { return this.escuchando ? (this.para(), false) : this.inicia(); },
  manosLibres(on) { this.manos = on; if (on) this.inicia(); else this.para(); },
  _voz() { const vs = speechSynthesis.getVoices(), loc = VOZ_LOC[LANG]; return vs.find(v => v.lang === loc) || vs.find(v => v.lang?.startsWith(LANG)) || null; },
  /* habla con el tono del rol; si hay manos libres, pausa el micrófono mientras habla */
  di(texto, rol = 'sistema') {
    if (!this.hablaOn || !this.sintesis() || !texto) return;
    const u = new SpeechSynthesisUtterance(String(texto).replace(/[«»"]/g, '').replace(/SpO₂/g, 'SpO2').replace(/ · /g, '. '));
    const p = ROLES[rol] || ROLES.sistema; u.pitch = p.pitch; u.rate = p.rate; u.lang = VOZ_LOC[LANG]; const v = this._voz(); if (v) u.voice = v;
    this._cola++;
    if (this.manos && this.escuchando) { this._pausaTTS = true; try { this.rec?.abort(); } catch {} }
    u.onend = u.onerror = () => { if (--this._cola <= 0) { this._cola = 0; if (this._pausaTTS) { this._pausaTTS = false; if (this.manos) setTimeout(() => this.inicia(), 200); } } };
    speechSynthesis.speak(u);
  },
  calla() { if (this.sintesis()) speechSynthesis.cancel(); this._cola = 0; }
};
/* para las pruebas automáticas y las demostraciones: simula una frase dicha */
window.simulaVoz = texto => VOZ._final([texto]);
