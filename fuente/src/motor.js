/* ══ motor.js — lógica pura del simulador (sin DOM; se prueba en Node) ══
   · Catálogo de ÓRDENES: lo que el combatiente dice (es/en/pt) → acción con nivel mínimo, tiempo y página del NSOCM Handbook 2023.
   · FISIOLOGÍA determinista por baja: pérdida de sangre por fuentes, neumotórax a tensión, vía aérea, hipotermia, TCE, agente nervioso.
   · RÚBRICA: cada punto se comprueba por código contra el registro de la sesión. La IA nunca puntúa.
   Los mensajes se devuelven como claves en español con parámetros; la interfaz los traduce con t().
   Páginas: numeración impresa del NSOCM Handbook 2023 (romanos = prefacio). */
const NIVELES = ['ASM', 'CLS', 'CMC', 'CPP'];
const NIV = {ASM: 0, CLS: 1, CMC: 2, CPP: 3};
const L3 = (es, en, pt) => ({es, en, pt});
const tx3 = (o, l) => (o && typeof o === 'object') ? (o[l] || o.es || '') : String(o ?? '');
const normz = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ── catálogo de órdenes ── (n = nombre corto; k = frases que lo activan, separadas por |; min = nivel mínimo; s = segundos que cuesta; p = página) */
const ACC = {
  // M · hemorragia masiva y fuego
  fuego: {c: 'M', min: 0, s: 3, p: '4', n: L3('Devolver fuego / ponerse a cubierto', 'Return fire / take cover', 'Responder ao fogo / abrigar-se'),
    k: L3('devuelvo fuego|devolver fuego|fuego de respuesta|me pongo a cubierto|nos ponemos a cubierto|ponte a cubierto|me cubro|cubrirse|busco cobertura|fuego de supresion|supresion', 'return fire|take cover|i take cover|get down|suppressive fire|suppress', 'respondo ao fogo|responder ao fogo|abrigo me|abrigar me|procuro abrigo|fogo de supressao')},
  mover: {c: 'M', min: 0, s: 15, p: '2', n: L3('Mover la baja a cubierto', 'Move casualty to cover', 'Mover o ferido para abrigo'),
    k: L3('lo arrastro|arrastro|arrastre|muevo la baja|mover la baja|lo llevo a cubierto|llevarlo a cubierto|lo saco|extraigo la baja|evacuo a cubierto', 'drag him|drag the casualty|move the casualty|move him to cover|pull him|extract the casualty', 'arrasto|arrastar|mover o ferido|levo o ferido|tiro o ferido|retirar o ferido')},
  barrido: {c: 'M', min: 0, s: 10, p: '4', n: L3('Barrido de sangrado de cabeza a pies', 'Head-to-toe blood sweep', 'Varrimento de hemorragias da cabeça aos pés'),
    k: L3('barrido|busco sangrado|busco hemorragia|de cabeza a pies|evaluacion rapida|reviso de arriba abajo|blood sweep', 'blood sweep|head to toe|rapid assessment|check for bleeding|look for bleeding', 'varrimento|da cabeca aos pes|avaliacao rapida|procuro hemorragia|procurar hemorragia')},
  tq: {c: 'M', min: 0, s: 25, p: '7-8', n: L3('Torniquete alto y apretado', 'Tourniquet high and tight', 'Torniquete alto e apertado'),
    k: L3('torniquete|garrote|cat ', 'tourniquet|cat tourniquet|tq ', 'torniquete|garrote')},
  tq2: {c: 'M', min: 0, s: 20, p: '7-8', n: L3('Segundo torniquete proximal', 'Second proximal tourniquet', 'Segundo torniquete proximal'),
    k: L3('segundo torniquete|otro torniquete|torniquete adicional|dos torniquetes', 'second tourniquet|another tourniquet|additional tourniquet', 'segundo torniquete|outro torniquete|torniquete adicional')},
  empaquetar: {c: 'M', min: 0, s: 40, p: '6-7', n: L3('Empaquetar la herida con agente hemostático', 'Pack the wound with hemostatic gauze', 'Tamponar a ferida com gaze hemostática'),
    k: L3('empaqueto|empaquetar|empaquetado|relleno la herida|taponamiento|tapono|gasa hemostatica|hemostatico|combat gauze|celox|quikclot', 'pack the wound|packing|wound packing|hemostatic|combat gauze|celox|quikclot|pack it', 'tamponar|tampono|tamponamento|gaze hemostatica|hemostatico|combat gauze|celox')},
  presion: {c: 'M', min: 0, s: 30, p: '6', n: L3('Presión directa / vendaje compresivo', 'Direct pressure / pressure dressing', 'Pressão direta / penso compressivo'),
    k: L3('presion directa|vendaje compresivo|vendaje de presion|venda israeli|vendaje de emergencia|aprieto la herida|comprimo', 'direct pressure|pressure dressing|pressure bandage|israeli bandage|emergency bandage|hold pressure', 'pressao direta|penso compressivo|ligadura compressiva|ligadura israelita|comprimo')},
  tqunion: {c: 'M', min: 1, s: 45, p: '7, vii', n: L3('Torniquete de unión (inguinal/axilar)', 'Junctional tourniquet', 'Torniquete juncional'),
    k: L3('torniquete de union|torniquete inguinal|torniquete axilar|torniquete de la union|sam junctional|sjt|jett|dispositivo de union', 'junctional tourniquet|junctional device|sam junctional|sjt|jett', 'torniquete juncional|dispositivo juncional|sam junctional|sjt|jett')},
  pelvica: {c: 'M', min: 1, s: 40, p: '7', n: L3('Faja pélvica', 'Pelvic binder', 'Cinta pélvica'),
    k: L3('faja pelvica|cinturon pelvico|binder|cincha pelvica|inmovilizo la pelvis', 'pelvic binder|binder|sam pelvic', 'cinta pelvica|cinto pelvico|imobilizador pelvico|binder')},
  marcar: {c: 'M', min: 0, s: 5, p: '6, 8', n: L3('Marcar la hora del torniquete', 'Mark the tourniquet time', 'Marcar a hora do torniquete'),
    k: L3('marco la hora|anoto la hora|apunto la hora|escribo la hora|hora del torniquete|marco el torniquete|marcar la hora', 'mark the time|write the time|tourniquet time|time on the tourniquet|mark the tourniquet', 'marco a hora|anoto a hora|escrevo a hora|hora do torniquete|marcar a hora')},
  convertir: {c: 'M', min: 2, s: 120, p: '9', n: L3('Conversión del torniquete', 'Tourniquet conversion', 'Conversão do torniquete'),
    k: L3('conversion del torniquete|convierto el torniquete|convertir el torniquete|convierto a vendaje', 'tourniquet conversion|convert the tourniquet|downgrade the tourniquet', 'conversao do torniquete|converter o torniquete|converto o torniquete')},
  // A · vía aérea
  frente: {c: 'A', min: 0, s: 8, p: '10', n: L3('Abrir la vía aérea (frente-mentón / tracción mandibular)', 'Open the airway (chin lift / jaw thrust)', 'Abrir a via aérea (elevação do queixo / tração da mandíbula)'),
    k: L3('frente menton|elevacion del menton|traccion mandibular|abro la via aerea|abrir la via aerea|apertura de la via aerea|maniobra frente|subluxacion', 'chin lift|jaw thrust|open the airway|head tilt', 'elevacao do queixo|tracao da mandibula|abro a via aerea|abrir a via aerea|extensao da cabeca')},
  npa: {c: 'A', min: 1, s: 15, p: '10', n: L3('Cánula nasofaríngea', 'Nasopharyngeal airway', 'Cânula nasofaríngea'),
    k: L3('canula nasofaringea|nasofaringea|npa|tubo nasal|canula nasal', 'nasopharyngeal|npa|nasal airway|nasal trumpet', 'canula nasofaringea|nasofaringea|npa|tubo nasal')},
  lateral: {c: 'A', min: 0, s: 10, p: '10', n: L3('Posición lateral de seguridad', 'Recovery position', 'Posição lateral de segurança'),
    k: L3('posicion lateral|lateral de seguridad|posicion de seguridad|posicion de recuperacion|lo pongo de lado|de costado', 'recovery position|on his side|lateral position', 'posicao lateral|lateral de seguranca|posicao de recuperacao|de lado')},
  sentado: {c: 'A', min: 0, s: 5, p: '10', n: L3('Dejar que adopte la postura que proteja su vía aérea (sentado)', 'Let him sit up to protect his airway', 'Deixar que se sente para proteger a via aérea'),
    k: L3('dejo que se siente|que se siente|lo incorporo|sentado hacia delante|posicion sentado|dejarlo sentado', 'let him sit up|sit him up|sitting up|sit forward', 'deixo que se sente|sentado|sentar o ferido|inclinado para a frente')},
  cric: {c: 'A', min: 2, s: 90, p: '11-12', n: L3('Cricotiroidotomía quirúrgica', 'Surgical cricothyroidotomy', 'Cricotiroidotomia cirúrgica'),
    k: L3('cricotiroidotomia|cricotomia|coniotomia|via aerea quirurgica|cric', 'cricothyroidotomy|cricothyrotomy|surgical airway|cric', 'cricotiroidotomia|cricotomia|via aerea cirurgica|cric')},
  sga: {c: 'A', min: 2, s: 30, p: '10', n: L3('Dispositivo supraglótico', 'Supraglottic airway', 'Dispositivo supraglótico'),
    k: L3('supraglotico|mascarilla laringea|igel|i gel|tubo laringeo', 'supraglottic|i gel|igel|laryngeal mask|king tube', 'supraglotico|mascara laringea|igel|i gel')},
  // R · respiración
  sello: {c: 'R', min: 0, s: 20, p: '13', n: L3('Parche torácico oclusivo', 'Occlusive chest seal', 'Selo torácico oclusivo'),
    k: L3('parche toracico|sello toracico|parche oclusivo|chest seal|sello de pecho|parche valvulado|sello en el pecho|tapo la herida del pecho|hyfin', 'chest seal|occlusive dressing|seal the chest|hyfin|vented seal', 'selo toracico|penso oclusivo|chest seal|selo no peito|hyfin')},
  ncd: {c: 'R', min: 1, s: 30, p: '13, 15', n: L3('Descompresión con aguja', 'Needle chest decompression', 'Descompressão com agulha'),
    k: L3('descompresion|descomprimo|descomprimir|aguja en el torax|toracocentesis|ncd|pincho el torax|catéter 14', 'needle decompression|decompress|ncd|needle the chest|needle thoracostomy', 'descompressao|descomprimo|descomprimir|agulha no torax|ncd')},
  digital: {c: 'R', min: 2, s: 120, p: '14, 16', n: L3('Toracostomía digital / tubo de tórax', 'Finger thoracostomy / chest tube', 'Toracostomia digital / dreno torácico'),
    k: L3('toracostomia digital|toracostomia con el dedo|toracostomia|tubo de torax|drenaje toracico|tubo toracico', 'finger thoracostomy|thoracostomy|chest tube', 'toracostomia digital|toracostomia|dreno toracico|tubo toracico')},
  bvm: {c: 'R', min: 1, s: 20, p: '10-11', n: L3('Ventilar con bolsa (BVM)', 'Bag-valve-mask ventilation', 'Ventilar com insuflador (BVM)'),
    k: L3('ambu|balon resucitador|bolsa autoinflable|ventilo con bolsa|bvm|ventilacion asistida|ventilo', 'bag valve|bvm|bag him|assist ventilation|ventilate', 'ambu|insuflador manual|bvm|ventilacao assistida|ventilo')},
  oxigeno: {c: 'R', min: 1, s: 10, p: '13, 25', n: L3('Oxígeno', 'Oxygen', 'Oxigénio'),
    k: L3('oxigeno|o2 ', 'oxygen|o2 ', 'oxigenio|o2 ')},
  // C · circulación
  iv: {c: 'C', min: 2, s: 45, p: '17, 20', n: L3('Vía intravenosa (≥18G) / saline lock', 'IV access (≥18G) / saline lock', 'Acesso intravenoso (≥18G) / saline lock'),
    k: L3('via intravenosa|via venosa|canalizo una via venosa|canalizo una vena|cateter venoso|via periferica|saline lock|iv ', 'iv access|intravenous|saline lock|iv line|start an iv|get an iv', 'acesso venoso|via intravenosa|cateter venoso|canalizo uma veia|via periferica')},
  io: {c: 'C', min: 2, s: 40, p: '22-23', n: L3('Vía intraósea', 'Intraosseous access', 'Acesso intraósseo'),
    k: L3('intraosea|intraoseo|io |fast1|ez io|via esternal|intraosea esternal', 'intraosseous|io access|sternal io|fast1|ez io', 'intraossea|intraosseo|acesso io|fast1')},
  txa: {c: 'C', min: 2, s: 20, p: '7, 17-18, 26, 175', n: L3('Ácido tranexámico', 'Tranexamic acid', 'Ácido tranexâmico'),
    k: L3('acido tranexamico|tranexamico|txa|amchafibrin', 'tranexamic|txa', 'acido tranexamico|tranexamico|txa')},
  sangre: {c: 'C', min: 2, s: 60, p: '17-18, 49-51', n: L3('Hemoderivados (sangre total / plasma)', 'Blood products (whole blood / plasma)', 'Hemoderivados (sangue total / plasma)'),
    k: L3('sangre total|transfusion|transfundo|transfundir|unidad de sangre|plasma liofilizado|plasma|hemoderivado|pongo sangre|doy sangre', 'whole blood|transfusion|transfuse|unit of blood|plasma|blood product|give blood', 'sangue total|transfusao|transfundir|unidade de sangue|plasma|hemoderivado|dou sangue')},
  calcio: {c: 'C', min: 2, s: 20, p: '18', n: L3('Calcio (gluconato) 1 g IV/IO lento', 'Calcium (gluconate) 1 g slow IV/IO', 'Cálcio (gluconato) 1 g IV/IO lento'),
    k: L3('calcio|gluconato calcico|gluconato de calcio|cloruro calcico', 'calcium', 'calcio|gluconato de calcio')},
  cristaloide: {c: 'C', min: 2, s: 20, p: '17', n: L3('Bolo de cristaloide', 'Crystalloid bolus', 'Bólus de cristaloide'),
    k: L3('suero fisiologico|cristaloide|ringer|bolo de suero|bolus de suero|abro el suero', 'saline bolus|crystalloid|ringer|normal saline|fluid bolus', 'soro fisiologico|cristaloide|ringer|bolus de soro')},
  pulso: {c: 'E', min: 0, s: 8, p: '19', n: L3('Comprobar pulso radial', 'Check radial pulse', 'Verificar pulso radial'),
    k: L3('pulso radial|tomo el pulso|compruebo el pulso|compruebo pulso|pulso|frecuencia cardiaca', 'radial pulse|check pulse|check his pulse|pulse|heart rate', 'pulso radial|verifico o pulso|pulso|frequencia cardiaca')},
  pulsodistal: {c: 'E', min: 0, s: 8, p: '6, 8', n: L3('Comprobar pulso distal al torniquete', 'Check pulse distal to tourniquet', 'Verificar pulso distal ao torniquete'),
    k: L3('pulso distal|compruebo el pulso distal|compruebo pulso distal|tomo el pulso distal|pulso pedio|pulso por debajo|pulso tibial', 'distal pulse|check the distal pulse|check distal pulse|pedal pulse|pulse below', 'pulso distal|verifico o pulso distal|pulso pedioso|pulso abaixo')},
  tension: {c: 'E', min: 1, s: 15, p: '19', n: L3('Medir tensión arterial', 'Measure blood pressure', 'Medir pressão arterial'),
    k: L3('tension arterial|presion arterial|tomo la tension', 'blood pressure|bp ', 'pressao arterial|tensao arterial')},
  spo2: {c: 'E', min: 0, s: 5, p: '10, 13', n: L3('Pulsioxímetro (SpO₂)', 'Pulse oximetry (SpO₂)', 'Oxímetro (SpO₂)'),
    k: L3('saturacion|pulsioximetro|pulsioximetria|spo2|oximetro|saturo', 'saturation|pulse ox|pulse oximeter|spo2|sats', 'saturacao|oximetro|oximetria|spo2')},
  fr: {c: 'E', min: 0, s: 8, p: '4', n: L3('Valorar la respiración', 'Assess breathing', 'Avaliar a respiração'),
    k: L3('frecuencia respiratoria|respira|ver oir sentir|cuento respiraciones|respiracion', 'respiratory rate|is he breathing|breathing|look listen feel', 'frequencia respiratoria|respira|ver ouvir sentir|respiracao')},
  torax: {c: 'E', min: 0, s: 12, p: '13', n: L3('Explorar el tórax', 'Examine the chest', 'Examinar o tórax'),
    k: L3('exploro el torax|exploro el pecho|ausculto|reviso el pecho|expongo el torax|miro el pecho|torax', 'check the chest|examine the chest|auscultate|expose the chest|listen to the chest', 'examino o torax|ausculto|exponho o torax|vejo o peito|torax')},
  reevaluar: {c: 'E', min: 0, s: 15, p: '6, 55', n: L3('Reevaluar a la baja y las intervenciones', 'Reassess casualty and interventions', 'Reavaliar o ferido e as intervenções'),
    k: L3('reevaluo|reevaluar|reevaluacion|vuelvo a evaluar|vuelvo a comprobar|compruebo el torniquete|reviso el torniquete|compruebo las intervenciones', 'reassess|re assess|recheck|check the tourniquet|check interventions', 'reavalio|reavaliar|reavaliacao|verifico o torniquete|volto a avaliar')},
  temp: {c: 'E', min: 1, s: 8, p: '24', n: L3('Medir temperatura', 'Check temperature', 'Medir temperatura'),
    k: L3('temperatura|termometro', 'temperature|thermometer', 'temperatura|termometro')},
  dolor: {c: 'E', min: 0, s: 6, p: '43-44', n: L3('Valorar el dolor (0-10)', 'Assess pain (0-10)', 'Avaliar a dor (0-10)'),
    k: L3('escala de dolor|cuanto le duele|cuanto te duele|evaluo el dolor|valoro el dolor|del uno al diez|dolor', 'pain score|pain scale|how bad is the pain|rate your pain|pain', 'escala de dor|quanto doi|avalio a dor|de um a dez|dor')},
  desarmar: {c: 'E', min: 0, s: 8, p: '4', n: L3('Desarmar a la baja con conciencia alterada', 'Disarm the casualty with altered mental status', 'Desarmar o ferido com consciência alterada'),
    k: L3('desarmo|le quito el arma|retiro el arma|desarmar|retiro la radio', 'disarm|take his weapon|remove his weapon', 'desarmo|desarmar|retiro a arma|tiro a arma')},
  // H · cabeza / hipotermia
  hpmk: {c: 'H', min: 0, s: 40, p: '24', n: L3('Prevención de hipotermia (HPMK, quitar ropa mojada)', 'Hypothermia prevention (HPMK, remove wet clothing)', 'Prevenção da hipotermia (HPMK, retirar roupa molhada)'),
    k: L3('manta termica|kit de hipotermia|hpmk|manta|abrigo a la baja|abrigar|evito la hipotermia|prevencion de hipotermia|blizzard|ropa mojada|hipotermia', 'hypothermia kit|hypothermia prevention|hpmk|blanket|blizzard|wet clothing|keep him warm|hypothermia', 'manta termica|kit de hipotermia|hpmk|manta|aquecer|roupa molhada|prevencao da hipotermia|hipotermia')},
  glasgow: {c: 'H', min: 0, s: 15, p: '11, 26', n: L3('Glasgow / AVDN', 'GCS / AVPU', 'Glasgow / AVDS'),
    k: L3('glasgow|gcs|nivel de conciencia|avdn|avpu|me oyes|como te llamas|esta consciente', 'glasgow|gcs|avpu|level of consciousness|can you hear me|what is your name', 'glasgow|gcs|nivel de consciencia|avds|avpu|como se chama')},
  pupilas: {c: 'H', min: 1, s: 8, p: '25-26', n: L3('Explorar pupilas', 'Check pupils', 'Examinar pupilas'),
    k: L3('pupilas|pupila', 'pupils|pupil', 'pupilas|pupila')},
  cabeza30: {c: 'H', min: 1, s: 8, p: '26', n: L3('Cabecera elevada 30°', 'Head of litter up 30°', 'Cabeceira elevada 30°'),
    k: L3('cabecera a 30|elevo la cabeza|cabeza elevada|cabecera elevada|30 grados', 'head up 30|elevate the head|30 degrees|head of the litter', 'cabeceira a 30|elevo a cabeca|cabeca elevada|30 graus')},
  hipertonico: {c: 'H', min: 2, s: 30, p: '26', n: L3('Suero hipertónico (signos de herniación)', 'Hypertonic saline (herniation signs)', 'Soro hipertónico (sinais de herniação)'),
    k: L3('suero hipertonico|salino hipertonico|hipertonica|hipertonico|23 4', 'hypertonic saline|hypertonic', 'soro hipertonico|salino hipertonico|hipertonico')},
  mace: {c: 'H', min: 1, s: 60, p: '27-28', n: L3('MACE 2 (cribado de conmoción)', 'MACE 2 (concussion screen)', 'MACE 2 (rastreio de concussão)'),
    k: L3('mace|cribado de conmocion|test de conmocion|evaluacion de conmocion', 'mace|concussion screen|concussion test', 'mace|rastreio de concussao|teste de concussao')},
  collarin: {c: 'H', min: 1, s: 45, p: '37-38', n: L3('Collarín cervical / restricción espinal', 'Cervical collar / spinal motion restriction', 'Colar cervical / restrição da coluna'),
    k: L3('collarin|collar cervical|inmovilizacion cervical|inmovilizo el cuello|control cervical', 'cervical collar|c collar|spinal immobilization|c spine', 'colar cervical|imobilizacao cervical|controlo cervical')},
  // dolor, antibióticos, ojo, fracturas
  cwpp: {c: 'P', min: 0, s: 10, p: '43-44', n: L3('Combat Wound Pill Pack (paracetamol + dexketoprofeno)', 'Combat Wound Pill Pack (acetaminophen + dexketoprofen)', 'Combat Wound Pill Pack (paracetamol + dexcetoprofeno)'),
    k: L3('pill pack|paquete de pastillas|pastillas de combate|kit de pastillas|paracetamol|dexketoprofeno|cwpp', 'pill pack|cwpp|acetaminophen|tylenol|dexketoprofen', 'pill pack|kit de comprimidos|paracetamol|dexcetoprofeno|cwpp')},
  otfc: {c: 'P', min: 2, s: 15, p: '43-44', n: L3('Fentanilo transmucoso oral (OTFC)', 'Oral transmucosal fentanyl (OTFC)', 'Fentanil transmucoso oral (OTFC)'),
    k: L3('fentanilo oral|piruleta|chupa chups|fentanilo transmucoso|otfc|actiq', 'otfc|fentanyl lozenge|oral fentanyl|actiq|lollipop', 'fentanil oral|pirulito|fentanil transmucoso|otfc|actiq')},
  ketamina: {c: 'P', min: 2, s: 30, p: '43-45', n: L3('(S-)ketamina IV/IO lenta', '(S-)ketamine slow IV/IO', '(S-)cetamina IV/IO lenta'),
    k: L3('ketamina|esketamina|ketolar', 'ketamine|esketamine', 'cetamina|ketamina|escetamina')},
  fentiv: {c: 'P', min: 2, s: 20, p: '43-44', n: L3('Fentanilo / hidromorfona IV/IO', 'IV/IO fentanyl / hydromorphone', 'Fentanil / hidromorfona IV/IO'),
    k: L3('fentanilo intravenoso|fentanilo iv|fentanilo|hidromorfona|morfina', 'iv fentanyl|fentanyl|hydromorphone|morphine', 'fentanil intravenoso|fentanil|hidromorfona|morfina')},
  ondansetron: {c: 'P', min: 2, s: 10, p: '43-44', n: L3('Ondansetrón', 'Ondansetron', 'Ondansetrom'),
    k: L3('ondansetron|zofran|antiemetico', 'ondansetron|zofran|antiemetic', 'ondansetrom|ondansetron|antiemetico')},
  naloxona: {c: 'P', min: 2, s: 10, p: '43-44', n: L3('Naloxona', 'Naloxone', 'Naloxona'),
    k: L3('naloxona|narcan', 'naloxone|narcan', 'naloxona|narcan')},
  antibiotico: {c: 'P', min: 2, s: 15, p: '6, 30, 32', n: L3('Antibiótico (moxifloxacino / ertapenem)', 'Antibiotic (moxifloxacin / ertapenem)', 'Antibiótico (moxifloxacina / ertapenem)'),
    k: L3('moxifloxacino|ertapenem|antibiotico|ceftriaxona', 'moxifloxacin|ertapenem|antibiotic|ceftriaxone', 'moxifloxacina|ertapenem|antibiotico|ceftriaxona')},
  ojo: {c: 'P', min: 0, s: 15, p: '32-33', n: L3('Protector ocular rígido (sin presión)', 'Rigid eye shield (no pressure)', 'Protetor ocular rígido (sem pressão)'),
    k: L3('protector ocular|escudo ocular|protector rigido|tapo el ojo|cubro el ojo|gafas sobre el ojo', 'eye shield|rigid shield|cover the eye|protect the eye', 'protetor ocular|escudo ocular|tapo o olho|cubro o olho')},
  ferula: {c: 'P', min: 0, s: 60, p: '39-40', n: L3('Férula / inmovilización de la fractura', 'Splint the fracture', 'Tala / imobilização da fratura'),
    k: L3('ferula|entablillo|inmovilizo la pierna|inmovilizo el brazo|inmovilizo la fractura|sam splint|sam', 'splint|immobilize the leg|immobilize the arm|sam splint', 'tala|imobilizo a perna|imobilizo o braco|imobilizo a fratura|sam splint')},
  // quemaduras
  apagar: {c: 'M', min: 0, s: 10, p: '41-42', n: L3('Detener el proceso de quemadura', 'Stop the burning process', 'Parar o processo de queimadura'),
    k: L3('apago las llamas|apago el fuego|detengo la quemadura|retiro la ropa quemada|apagar las llamas|corto la ropa quemada|lo saco del vehiculo', 'put out the flames|stop the burning|remove burning clothing|pull him out of the vehicle', 'apago as chamas|parar a queimadura|retiro a roupa queimada|tiro-o do veiculo')},
  tbsa: {c: 'E', min: 1, s: 20, p: '41-42', n: L3('Estimar % superficie quemada (regla de los nueves)', 'Estimate % TBSA burned (rule of nines)', 'Estimar % de superfície queimada (regra dos noves)'),
    k: L3('regla de los nueves|superficie corporal|superficie quemada|porcentaje quemado|tbsa|por ciento quemado', 'rule of nines|tbsa|body surface|percent burned', 'regra dos noves|superficie corporal|superficie queimada|tbsa|por cento queimado')},
  aposito: {c: 'P', min: 0, s: 30, p: '41-42', n: L3('Cubrir quemaduras con apósitos secos', 'Cover burns with dry dressings', 'Cobrir queimaduras com pensos secos'),
    k: L3('aposito seco|apositos secos|gasa esteril seca|cubro las quemaduras|cubrir las quemaduras', 'dry dressing|dry sterile dressing|cover the burns', 'penso seco|pensos secos|cubro as queimaduras|cobrir as queimaduras')},
  regla10: {c: 'C', min: 2, s: 20, p: '41-42', n: L3('Fluidos de quemado: regla del 10 (USAISR)', 'Burn fluids: rule of ten (USAISR)', 'Fluidos de queimado: regra dos 10 (USAISR)'),
    k: L3('regla del diez|regla de los diez|regla del 10|regla de los 10|sueroterapia del quemado|mililitros hora|ml hora', 'rule of ten|rule of 10|burn fluids|ml per hour|ml an hour', 'regra dos dez|regra dos 10|fluidos do queimado|ml por hora')},
  // comunicación, documentación, evacuación
  c2: {c: 'K', min: 0, s: 10, p: '4, 55', n: L3('Informar al mando (C2)', 'Report to command (C2)', 'Informar o comando (C2)'),
    k: L3('informo al mando|aviso al mando|comunico a c2|informo a c2|al jefe de patrulla|informo al jefe|llamo al sanitario|pido sanitario|aviso al sanitario', 'inform command|notify c2|report to c2|tell the team leader|call the medic|get the medic', 'informo o comando|aviso o comando|comunico ao c2|chamo o socorrista')},
  medevac: {c: 'K', min: 1, s: 0, p: '55-56', n: L3('Petición de evacuación (9 líneas)', 'Evacuation request (9-line)', 'Pedido de evacuação (9 linhas)'),
    k: L3('nueve lineas|9 lineas|pido medevac|solicito medevac|solicito evacuacion|pido evacuacion|medevac|casevac', '9 line|nine line|medevac request|request medevac|request casevac|medevac|casevac', '9 linhas|nove linhas|pedido medevac|peco evacuacao|medevac|casevac')},
  mist: {c: 'K', min: 1, s: 0, p: '56, 58', n: L3('Informe MIST', 'MIST report', 'Relatório MIST'),
    k: L3('informe mist|parte mist|mist', 'mist report|mist', 'relatorio mist|mist')},
  tarjeta: {c: 'K', min: 0, s: 20, p: 'ii, 57', n: L3('Rellenar la tarjeta de baja (TCCC)', 'Complete the casualty card (TCCC)', 'Preencher o cartão de ferido (TCCC)'),
    k: L3('tarjeta de baja|tarjeta tccc|ficha de baja|tarjeta|documento la asistencia|documento', 'casualty card|tccc card|card|document', 'cartao de ferido|cartao tccc|ficha de ferido|cartao|documento')},
  camilla: {c: 'K', min: 0, s: 60, p: '57', n: L3('Empaquetar en camilla para evacuación', 'Package on litter for evacuation', 'Acondicionar na maca para evacuação'),
    k: L3('empaqueto para evacuacion|preparo la camilla|aseguro en la camilla|en la camilla|camilla|skedco', 'package for evac|package him|litter|skedco|stretcher', 'acondiciono para evacuacao|maca|skedco|preparo a maca')},
  relevo: {c: 'K', min: 1, s: 30, p: '58', n: L3('Transferencia al equipo de evacuación', 'Handover to evacuation crew', 'Passagem ao equipa de evacuação'),
    k: L3('transferencia|relevo|entrego la baja|traspaso|handover', 'handover|hand over|hand off', 'passagem|entrego o ferido|transferencia|handover')},
  controlmed: {c: 'K', min: 2, s: 30, p: 'ii', n: L3('Contactar con control médico / director médico', 'Contact medical control / medical director', 'Contactar o controlo médico / diretor médico'),
    k: L3('control medico|director medico|llamo al medico|contacto con el medico|telemedicina|oficial medico', 'medical control|medical director|call the doctor|telemedicine|medical officer', 'controlo medico|diretor medico|chamo o medico|telemedicina|oficial medico')},
  colaciono: {c: 'K', min: 1, s: 5, p: 'iii', n: L3('Repetir en voz alta la orden recibida', 'Read back the order received', 'Repetir em voz alta a ordem recebida'),
    k: L3('repito la orden|confirmo la orden|colaciono|repito|recibido administro|recibido', 'read back|repeat the order|copy|roger', 'repito a ordem|confirmo a ordem|repito|recebido')},
  // triaje
  urgente: {c: 'T', min: 0, s: 3, p: '2-3', n: L3('Triaje: URGENTE', 'Triage: URGENT', 'Triagem: URGENTE'),
    k: L3('urgente|categoria roja|rojo|inmediato', 'urgent|red|immediate', 'urgente|vermelho|imediato')},
  prioritario: {c: 'T', min: 0, s: 3, p: '2-3', n: L3('Triaje: PRIORITARIO', 'Triage: PRIORITY', 'Triagem: PRIORITÁRIO'),
    k: L3('prioritario|prioridad|amarillo|diferido', 'priority|yellow|delayed', 'prioritario|amarelo|diferido')},
  rutina: {c: 'T', min: 0, s: 3, p: '2-3', n: L3('Triaje: RUTINA / leve', 'Triage: ROUTINE / minimal', 'Triagem: ROTINA / ligeiro'),
    k: L3('rutina|verde|leve|herido que camina|menor', 'routine|green|minimal|walking wounded|minor', 'rotina|verde|ligeiro|ferido que caminha')},
  expectante: {c: 'T', min: 0, s: 3, p: '2-3', n: L3('Triaje: EXPECTANTE', 'Triage: EXPECTANT', 'Triagem: EXPECTANTE'),
    k: L3('expectante|azul|negro', 'expectant|blue|black', 'expectante|azul|preto')},
  confort: {c: 'T', min: 0, s: 30, p: '2', n: L3('Medidas de confort y analgesia al expectante', 'Comfort measures and analgesia for the expectant', 'Medidas de conforto e analgesia ao expectante'),
    k: L3('medidas de confort|confort|acompano|le acompano|lo acompano|confortar|cuidados paliativos', 'comfort measures|comfort care|stay with him|comfort', 'medidas de conforto|conforto|acompanho|cuidados paliativos')},
  rcp: {c: 'T', min: 0, s: 60, p: 'iii, 13', n: L3('Iniciar RCP', 'Start CPR', 'Iniciar RCP'),
    k: L3('rcp|reanimacion cardiopulmonar|masaje cardiaco|compresiones toracicas', 'cpr|chest compressions|cardiopulmonary', 'rcp|reanimacao|massagem cardiaca|compressoes toracicas')},
  certificar: {c: 'T', min: 3, s: 20, p: 'iii', n: L3('Certificar el fallecimiento', 'Pronounce death', 'Declarar o óbito'),
    k: L3('certifico la muerte|declaro fallecido|declaro la muerte|certifico el fallecimiento|hora de la muerte', 'pronounce death|pronounce him dead|time of death', 'declaro o obito|certifico o obito|hora do obito')},
  // NRBQ
  mascara: {c: 'M', min: 0, s: 10, p: '62, 66', n: L3('Comprobar / colocar la máscara (NRBQ)', 'Mask check (CBRN)', 'Verificar / colocar a máscara (NRBQ)'),
    k: L3('compruebo la mascara|ajusto la mascara|le pongo la mascara|mascara de gas|careta|mascara', 'mask check|gas mask|check his mask|put his mask on|mask', 'verifico a mascara|ajusto a mascara|mascara de gas|mascara')},
  atnaa: {c: 'A', min: 0, s: 15, p: '63, 66', n: L3('Autoinyector ATNAA (atropina + pralidoxima)', 'ATNAA auto-injector (atropine + pralidoxime)', 'Autoinjetor ATNAA (atropina + pralidoxima)'),
    k: L3('atnaa|autoinyector|atropina|pralidoxima|2 pam|duodote', 'atnaa|auto injector|autoinjector|atropine|pralidoxime|2 pam|duodote', 'atnaa|autoinjetor|atropina|pralidoxima|2 pam')},
  cana: {c: 'A', min: 1, s: 10, p: '63, 66', n: L3('CANA (diazepam anticonvulsivo)', 'CANA (diazepam anticonvulsant)', 'CANA (diazepam anticonvulsivo)'),
    k: L3('cana|diazepam|midazolam|anticonvulsivo', 'cana|diazepam|midazolam|anticonvulsant', 'cana|diazepam|midazolam|anticonvulsivo')},
  rsdl: {c: 'R', min: 0, s: 40, p: '62, 66', n: L3('Descontaminación puntual (RSDL, seco-húmedo-seco)', 'Spot decontamination (RSDL, dry-wet-dry)', 'Descontaminação pontual (RSDL, seco-húmido-seco)'),
    k: L3('rsdl|descontamino|descontaminacion|descontaminar|seco humedo seco', 'rsdl|decon|decontaminate|decontamination|dry wet dry', 'rsdl|descontamino|descontaminacao|descontaminar|seco humido seco')},
  cyanokit: {c: 'C', min: 2, s: 30, p: '64, 67', n: L3('Cyanokit (hidroxocobalamina)', 'Cyanokit (hydroxocobalamin)', 'Cyanokit (hidroxocobalamina)'),
    k: L3('cyanokit|hidroxocobalamina|nitrito sodico', 'cyanokit|hydroxocobalamin|sodium nitrite', 'cyanokit|hidroxocobalamina|nitrito de sodio')},
  // explosión
  oidos: {c: 'E', min: 1, s: 20, p: '31', n: L3('Explorar oídos / tímpanos', 'Check ears / eardrums', 'Examinar ouvidos / tímpanos'),
    k: L3('otoscopia|reviso los oidos|exploro los oidos|timpano|timpanos|oidos|zumbido', 'check the ears|eardrum|tympanic|ears|ringing', 'ouvidos|timpano|timpanos|zumbido')},
  observar: {c: 'E', min: 1, s: 5, p: '31', n: L3('Observación mínima de 6 horas tras explosión', 'Observe at least 6 hours after blast', 'Observação mínima de 6 horas após explosão'),
    k: L3('observacion 6 horas|observacion de 6 horas|seis horas|6 horas|vigilancia 6 horas', 'six hours|6 hours|observe for 6', 'seis horas|6 horas|observacao 6 horas')}
};
const ACC_IDS = Object.keys(ACC);
/* ámbito: una orden solo sirve si la baja tiene algo que la justifique (si no, se registra como «sin indicación», sin penalizar salvo que la rúbrica lo diga) */
const NUM_PAL = {cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  um: 1, uma: 1, dois: 2, duas: 2, quatro: 4, sete: 7, oito: 8, nove: 9, dez: 10, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60};
/* números que aparecen en una frase (cifras o palabras sencillas; «treinta y cinco» → 35) */
function numeros(s) {
  const w = normz(s).split(' '), out = [];
  for (let i = 0; i < w.length; i++) {
    if (/^\d+$/.test(w[i])) { out.push(+w[i]); continue; }
    if (w[i] in NUM_PAL) { let v = NUM_PAL[w[i]]; if (v >= 20 && (w[i + 1] === 'y' || w[i + 1] === 'and' || w[i + 1] === 'e') && w[i + 2] in NUM_PAL && NUM_PAL[w[i + 2]] < 10) { v += NUM_PAL[w[i + 2]]; i += 2; } out.push(v); }
  }
  return out;
}

/* ── reconocimiento de órdenes: frase → acciones (coincidencias más largas, sin solaparse, en orden) ── */
const _kwCache = {};
function kwDe(lang) {
  if (_kwCache[lang]) return _kwCache[lang];
  const l = [];
  for (const id of ACC_IDS) for (const k of tx3(ACC[id].k, lang).split('|')) { const kk = normz(k); if (kk) l.push([kk, id, / $/.test(k)]); }
  l.sort((a, b) => b[0].length - a[0].length);
  return (_kwCache[lang] = l);
}
function interpreta(frase, lang = 'es') {
  const s = ' ' + normz(frase) + ' ', ocup = new Array(s.length).fill(false), hits = [];
  for (const [kw, id] of kwDe(lang)) {
    const re = new RegExp('(?<=\\s)' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s)', 'g'); let m;
    while ((m = re.exec(s))) { const a = m.index, b = a + kw.length; if (ocup.slice(a, b).some(Boolean)) continue; for (let i = a; i < b; i++) ocup[i] = true; hits.push({id, pos: a}); }
  }
  hits.sort((a, b) => a.pos - b.pos);
  const ids = []; for (const h of hits) if (!ids.includes(h.id)) ids.push(h.id);
  return ids;
}
/* órdenes que no son acciones clínicas: cambiar de baja, elegir opción, terminar, repetir */
function meta(frase, lang = 'es') {
  const s = ' ' + normz(frase) + ' ';
  const baja = s.match(/ (?:baja|herido|casualty|patient|ferido|vitima|paciente) (?:numero |number |n )?(\d|uno|una|dos|tres|cuatro|one|two|three|four|um|uma|dois|duas|quatro|alfa|alpha|bravo|charlie|delta) /);
  const mapB = {1: 0, uno: 0, una: 0, one: 0, um: 0, uma: 0, alfa: 0, alpha: 0, 2: 1, dos: 1, two: 1, dois: 1, duas: 1, bravo: 1, 3: 2, tres: 2, three: 2, charlie: 2, 4: 3, cuatro: 3, four: 3, quatro: 3, delta: 3};
  const op = s.match(/ (?:opcion|option|opcao|respuesta|answer|resposta) (a|b|c|d|alfa|alpha|bravo|charlie|delta|uno|dos|tres|one|two|three|um|dois|tres) /) || s.match(/^ (a|b|c|d|alfa|alpha|bravo|charlie|delta) $/);
  const mapO = {a: 'a', alfa: 'a', alpha: 'a', uno: 'a', one: 'a', um: 'a', b: 'b', bravo: 'b', dos: 'b', two: 'b', dois: 'b', c: 'c', charlie: 'c', tres: 'c', three: 'c', d: 'd', delta: 'd'};
  return {
    baja: baja ? mapB[baja[1]] : null,
    opcion: op ? mapO[op[1]] : null,
    fin: / (fin de la simulacion|termino la simulacion|terminar simulacion|fin del ejercicio|end simulation|end exercise|end of exercise|fim da simulacao|terminar a simulacao|fim do exercicio) /.test(s),
    repite: / (repite|repitelo|repeat|say again|repete|repita) /.test(s) && s.length < 30,
    estado: / (constantes|signos vitales|vital signs|sinais vitais|como esta|how is he|como esta ele) /.test(s)
  };
}

/* ── bajas y fisiología ── */
function nuevaBaja(def, i) {
  return {
    id: def.id || 'B' + (i + 1), nombre: def.nombre || L3('Baja ' + (i + 1), 'Casualty ' + (i + 1), 'Ferido ' + (i + 1)), lesion: def.lesion || L3('', '', ''),
    vol: 5000, perd: def.perd0 || 0, fuentes: (def.fuentes || []).map(f => ({...f, ctl: 0, tqs: 0, pres: 0, pack: false})),
    neumo: def.neumo ? {sev: def.neumo.sev0 || 0, vel: def.neumo.vel || 1 / 240, activo: !!def.neumo.activo, abierta: !!def.neumo.abierta, sellada: false, desc: 0, tDesc: null, recurre: def.neumo.recurre || 0, toracost: false} : null,
    via: def.via ? {obs: true, nivel: 0, necesita: def.via.necesita || 'frente', tObs: 0} : null,
    tce: def.tce ? {gcs0: def.tce.gcs, dano: 0, hern: false} : null,
    temp: def.temp ?? 36.8, frio: def.frio || 1, hpmk: false, dolor: def.dolor ?? 5, analg: 0, opioide: 0, depresion: false,
    txa: 0, sangre: 0, crist: 0, calcio: 0, acceso: false, binder: false, quem: def.quem || null, nrbq: def.nrbq ? {sev: def.nrbq.sev, tipo: def.nrbq.tipo || 'nervioso', atnaa: 0, cana: false, mask: false, decon: false} : null,
    expectante: !!def.expectante, camina: !!def.camina, ordena: def.ordena !== false, fractura: def.fractura || null, ojo: !!def.ojo, mtbi: !!def.mtbi, timpano: !!def.timpano,
    cat: null, catOk: def.cat || null, muerto: false, causa: null, hipoxT: 0, spo2: def.spo2 ?? 98, notas: []
  };
}
/* constantes derivadas del estado (determinista) */
function vitales(b) {
  if (b.muerto) return {fc: 0, tas: 0, fr: 0, spo2: 0, avdn: 'N', gcs: 3, radial: false, rc: 9, temp: +b.temp.toFixed(1), dolor: 0, pupilas: 'midriasis arreactiva'};
  const p = b.perd / b.vol, ns = b.neumo ? b.neumo.sev : 0, nv = b.nrbq ? b.nrbq.sev : 0;
  let fc = p < .15 ? 82 + p * 100 : p < .3 ? 97 + (p - .15) * 150 : p < .4 ? 120 + (p - .3) * 200 : 140 + (p - .4) * 150;
  fc += (b.dolor > 6 ? 8 : 0) + ns * 25 - nv * 45 + (b.temp < 35 ? -6 : 0);
  let tas = p < .3 ? 122 - p * 35 : p < .4 ? 111 - (p - .3) * 310 : 80 - (p - .4) * 300;
  if (ns > .6) tas -= (ns - .6) * 110; if (b.tce?.hern) tas += 25;
  let fr = 15 + p * 30 + ns * 22 + (b.via?.obs ? 10 : 0) + nv * 8 - (b.depresion ? 10 : 0);
  if (b.depresion) fr = Math.min(fr, 6);
  let gcs = 15;
  if (b.tce) gcs = clamp(b.tce.gcs0 - Math.floor(b.tce.dano / 240) - (b.tce.hern ? 2 : 0), 3, 15);
  const sp = b.spo2;
  if (p > .4 || sp < 75) gcs = Math.min(gcs, 8); else if (p > .3 || sp < 85) gcs = Math.min(gcs, 13);
  if (b.nrbq && nv > .7) gcs = Math.min(gcs, 7); if (b.depresion) gcs = Math.min(gcs, 9);
  if (b.expectante) gcs = Math.min(gcs, 4);
  const avdn = gcs >= 14 ? 'A' : gcs >= 10 ? 'V' : gcs >= 6 ? 'D' : 'N';
  const pup = b.tce?.hern ? 'anisocoria (derecha dilatada)' : b.nrbq && nv > .2 ? 'miosis' : b.expectante ? 'midriasis arreactiva' : 'normales y reactivas';
  return {fc: Math.round(clamp(fc, 30, 180)), tas: Math.round(clamp(tas, 0, 160)), fr: Math.round(clamp(fr, 0, 50)), spo2: Math.round(clamp(sp, 40, 99)), avdn, gcs, radial: tas >= 80, rc: p > .3 ? 4 : p > .15 ? 3 : 1.5, temp: +b.temp.toFixed(1), dolor: Math.round(clamp(b.dolor - b.analg, 0, 10)), pupilas: pup};
}
function hemorragiaActiva(b) { return b.fuentes.some(f => f.tipo !== 'int' && f.rate * (1 - f.ctl) > 15); }  // solo la que se ve
/* avanza la fisiología dt segundos */
function tick(st, dt) {
  st.t += dt;
  for (const b of st.bajas) {
    if (b.muerto) continue;
    const coag = (b.temp < 35 ? 1.25 : 1) * (b.crist > 1000 ? 1.2 : 1);
    for (const f of b.fuentes) {
      let r = f.rate * (1 - f.ctl);
      if (f.tipo === 'int') r *= (b.txa ? .75 : 1) * (f.pelv && b.binder ? .45 : 1);
      b.perd += r * coag * dt / 60;
    }
    b.perd = Math.max(0, b.perd);
    if (b.neumo) {
      const n = b.neumo;
      if (n.desc && n.recurre && !n.toracost && st.t - n.tDesc >= n.recurre) { n.desc = 0; n.activo = true; n.recurre = 0; st.ev.push({t: st.t, k: 'Reaparecen los signos de neumotórax a tensión en {0}.', b: b.id}); }
      if (n.activo && !n.desc) n.sev = clamp(n.sev + n.vel * dt, 0, 1);
    }
    if (b.via) { if (b.via.obs) b.via.tObs += dt; else b.via.tObs = Math.max(0, b.via.tObs - dt * 3); }
    const p = b.perd / b.vol;
    let sp = 98 - 48 * (b.neumo ? b.neumo.sev : 0) - (b.via?.obs ? Math.min(45, b.via.tObs / 4) : 0) - (p > .38 ? (p - .38) * 120 : 0) - (b.nrbq ? b.nrbq.sev * 30 : 0) - (b.depresion ? 18 : 0) - (b.quem?.inhal && !b.quem.o2 ? 6 : 0);
    if (b.o2) sp += 4;
    b.spo2 = clamp(sp, 40, 99);
    b.hipoxT = b.spo2 < 70 ? b.hipoxT + dt : Math.max(0, b.hipoxT - dt);
    if (!b.hpmk) b.temp -= .03 * b.frio * (p > .2 ? 2 : 1) * dt / 60; else b.temp = Math.min(37, b.temp + .006 * dt / 60);
    if (b.tce) { const v = vitales(b); if (v.tas < 90 || v.spo2 < 90) b.tce.dano += dt; }
    if (b.nrbq && b.nrbq.tipo === 'nervioso' && b.nrbq.atnaa < 3) b.nrbq.sev = clamp(b.nrbq.sev + dt / 900, 0, 1);
    if (b.analg && st.t % 60 < dt) b.analg = Math.max(0, b.analg - .2);
    if (p >= .5) muere(st, b, 'Exanguinación');
    else if (b.hipoxT > 180) muere(st, b, 'Hipoxia');
    else if (b.temp < 31) muere(st, b, 'Hipotermia grave con coagulopatía');
    else if (b.nrbq && b.nrbq.sev >= 1) muere(st, b, 'Intoxicación por agente nervioso');
  }
  for (const e of st.prog) if (!e.hecho && st.t >= e.t) { e.hecho = true; inyecta(st, e.tipo, e.b, true); }
}
function muere(st, b, causa) { if (b.muerto || b.expectante) { if (b.expectante && !b.muerto && causa === 'Exanguinación') { b.muerto = true; b.causa = causa; st.ev.push({t: st.t, k: '{0} ya no tiene signos vitales.', b: b.id}); } return; } b.muerto = true; b.causa = causa; st.ev.push({t: st.t, k: '{0} ha fallecido: {1}.', b: b.id, a: [causa]}); }

/* ── sesión ── */
function nuevaSesion(esc, nivel, opts = {}) {
  const st = {esc: esc.id, nivel, niv: NIV[nivel], t: 0, fase: esc.fuego ? 'cuf' : 'tfc', fuego: !!esc.fuego, tFuego: 0, herido: false,
    bajas: esc.bajas.map(nuevaBaja), act: 0, log: [], ev: [], dec: {}, form: {}, prog: (esc.eventos || []).map(e => ({...e, hecho: false})), fin: false, semilla: opts.semilla || '', lang: opts.lang || 'es'};
  return st;
}
const bajaAct = st => st.bajas[st.act] || st.bajas[0];
/* registra y aplica una orden; devuelve {k, a, ok, voz} (k = mensaje en español con {n}) */
function ejecuta(st, id, opts = {}) {
  const A = ACC[id]; if (!A) return {ok: false, k: 'Orden desconocida.'};
  const b = opts.b != null ? st.bajas[opts.b] : bajaAct(st);
  const fuera = A.min > st.niv;
  const reg = {t: Math.round(st.t), a: id, b: b.id, fase: st.fase, fuera, n: opts.n ?? null};
  st.log.push(reg);
  if (fuera) return {ok: false, fuera: true, k: '«{0}» está fuera del alcance de tu nivel ({1}). Pide ayuda a quien tenga ese nivel (p. {2}).', a: [A.n, st.nivel, A.p]};
  if (A.s) tick(st, A.s);
  if (b.muerto && !['certificar', 'tarjeta', 'c2', 'medevac', 'mist', 'expectante', 'confort', 'rcp'].includes(id)) return {ok: false, k: '{0} ya no tiene signos de vida.', a: [b.id]};
  const r = efecto(st, b, id, opts) || {ok: true, k: 'Hecho.'};
  tick(st, 0);
  reg.ok = r.ok !== false; if (r.cod) reg.cod = r.cod;
  return r;
}
const fuenteExt = (b, tipo = 'ext') => b.fuentes.filter(f => f.tipo === tipo).sort((x, y) => y.rate * (1 - y.ctl) - x.rate * (1 - x.ctl))[0];
function efecto(st, b, id, o) {
  const v = () => vitales(b), Z = f => tx3(f.zona, st.lang);
  switch (id) {
    case 'fuego': if (st.fuego) { st.cubierto = true; return {k: 'Fuego de supresión. Superioridad de fuego conseguida; ahora puedes alcanzar a la baja.'}; } return {k: 'No hay fuego enemigo eficaz en este momento.', cod: 'sin_ind'};
    case 'mover': if (st.fase === 'cuf') { st.fase = 'tfc'; st.fuego = false; return {k: 'Baja a cubierto. Empieza la fase de atención táctica en campo (TFC).'}; } return {k: 'La baja ya está a cubierto.'};
    case 'barrido': { const act = b.fuentes.filter(f => f.tipo !== 'int' && f.rate * (1 - f.ctl) > 15); b.vistoBarrido = true; return act.length ? {k: 'Barrido: sangrado activo en {0}.', a: [act.map(Z).join(' · ')], voz: 1} : {k: 'Barrido: no encuentras sangrado externo activo.'}; }
    case 'tq': case 'tq2': {
      const f = fuenteExt(b, 'ext');
      if (!f) { const j = fuenteExt(b, 'junc'); if (j) return {ok: false, k: 'La herida está en la unión ({0}): un torniquete de extremidad no cabe por encima. Empaqueta y comprime o usa un torniquete de unión (p. vii, 6-7).', a: [Z(j)], cod: 'tq_union'}; return {ok: false, k: 'No hay una hemorragia de extremidad que necesite torniquete.', cod: 'sin_ind'}; }
      f.tqs++; f.tqT = f.tqT ?? st.t;
      f.ctl = f.dosTq && f.tqs < 2 ? .8 : .98;
      if (st.fase === 'cuf') f.sobreRopa = true;
      return f.ctl < .9 ? {k: 'Torniquete en {0}: la hemorragia disminuye pero sigue sangrando y hay pulso distal. En el muslo suele hacer falta un segundo torniquete proximal (p. 7).', a: [Z(f)], voz: 1} : {k: 'Torniquete en {0}: hemorragia controlada. Marca la hora (p. 8).', a: [Z(f)]};
    }
    case 'empaquetar': {
      const f = fuenteExt(b, 'junc') || fuenteExt(b, 'ext');
      if (!f || f.rate * (1 - f.ctl) < 5) return {ok: false, k: 'No hay una cavidad sangrante que empaquetar.', cod: 'sin_ind'};
      f.pack = true; f.ctl = Math.max(f.ctl, .75);
      return {k: 'Herida en {0} empaquetada con gasa hemostática. Mantén presión directa al menos 3 minutos (p. 6).', a: [Z(f)]};
    }
    case 'presion': {
      const f = fuenteExt(b, 'junc') || fuenteExt(b, 'ext'); if (!f) return {ok: false, k: 'No hay sangrado externo que comprimir.', cod: 'sin_ind'};
      f.pres++; if (f.pack) f.ctl = Math.max(f.ctl, .93); else f.ctl = Math.max(f.ctl, f.rate > 150 ? .45 : .9);
      return f.pack ? {k: 'Presión mantenida y vendaje compresivo sobre el empaquetado: sangrado controlado en {0}.', a: [Z(f)]} : f.rate > 150 ? {k: 'La presión directa sola no basta: sigue sangrando en {0}.', a: [Z(f)], voz: 1} : {k: 'Vendaje compresivo: sangrado controlado en {0}.', a: [Z(f)]};
    }
    case 'tqunion': { const j = fuenteExt(b, 'junc'); if (!j) return {ok: false, k: 'No hay una hemorragia de unión.', cod: 'sin_ind'}; j.ctl = Math.max(j.ctl, .95); return {k: 'Torniquete de unión colocado en {0}: hemorragia controlada.', a: [Z(j)]}; }
    case 'pelvica': b.binder = true; return b.fuentes.some(f => f.pelv) ? {k: 'Faja pélvica colocada a la altura de los trocánteres.'} : {k: 'Faja pélvica colocada.', cod: b.fuentes.some(f => f.tipo === 'ext' && f.amput) ? undefined : 'sin_ind'};
    case 'marcar': { const fs = b.fuentes.filter(f => f.tqs); if (!fs.length) return {ok: false, k: 'No hay ningún torniquete que marcar.', cod: 'sin_ind'}; fs.forEach(f => f.marcado = true); return {k: 'Hora del torniquete marcada en la baja y en la tarjeta.'}; }
    case 'convertir': {
      const f = b.fuentes.find(x => x.tqs); if (!f) return {ok: false, k: 'No hay torniquete que convertir.', cod: 'sin_ind'};
      const vv = v(); if (!vv.radial || st.fase === 'cuf') return {ok: false, k: 'No conviertas ahora: la baja está en shock o la situación táctica no lo permite (p. 6, 9).', cod: 'conv_mal'};
      f.ctl = .95; f.convertido = true; return {k: 'Conversión hecha: torniquete aflojado, empaquetado con vendaje compresivo; sangrado controlado. Deja el torniquete flojo en su sitio.'};
    }
    case 'frente': if (b.via?.obs) { b.via.nivel = Math.max(b.via.nivel, 1); if (b.via.necesita === 'frente') b.via.obs = false; return b.via.obs ? {k: 'Abres la vía aérea, pero vuelve a obstruirse en cuanto la sueltas: ronquido y saturación baja.', voz: 1} : {k: 'Vía aérea abierta: respira mejor.'}; } return {k: 'La vía aérea está permeable: habla con normalidad (p. 4).', cod: 'sin_ind'};
    case 'npa': if (b.via?.obs) { b.via.nivel = Math.max(b.via.nivel, 2); if (['frente', 'npa'].includes(b.via.necesita)) b.via.obs = false; return b.via.obs ? {k: 'Cánula colocada, pero la obstrucción persiste: sangre y destrozo facial. Considera la vía aérea quirúrgica (p. 10-11).', voz: 1} : {k: 'Cánula nasofaríngea colocada: vía aérea permeable.'}; } return {k: 'Cánula colocada.', cod: 'sin_ind'};
    case 'lateral': if (b.via?.obs && b.via.necesita !== 'cric') { b.via.obs = false; return {k: 'En posición lateral: drena y la vía aérea queda permeable.'}; } return {k: 'Baja en posición lateral de seguridad.'};
    case 'sentado': if (b.via?.obs && b.via.necesita === 'sentado') { b.via.obs = false; return {k: 'Se inclina hacia delante: drena la sangre y respira mejor.'}; } if (vitales(b).avdn !== 'A') return {ok: false, k: 'La baja no está consciente: no puede sentarse por sí misma.', cod: 'sin_ind'}; return {k: 'La baja adopta la postura que le resulta más cómoda.'};
    case 'cric': if (b.via) { b.via.obs = false; b.via.nivel = 3; return {k: 'Cricotiroidotomía: tubo colocado y confirmado (empañamiento, ruidos, SpO₂). Fíjalo (p. 12).'}; } return {ok: false, k: 'No hay indicación de vía aérea quirúrgica.', cod: 'sin_ind'};
    case 'sga': if (b.via?.obs && b.via.necesita !== 'cric') { b.via.obs = false; return {k: 'Supraglótico colocado.'}; } return b.via?.obs ? {ok: false, k: 'El supraglótico no sella: trauma facial. Necesitas vía quirúrgica.', voz: 1} : {k: 'Supraglótico colocado.', cod: 'sin_ind'};
    case 'sello': if (b.neumo?.abierta && !b.neumo.sellada) { b.neumo.sellada = true; b.neumo.activo = true; return {k: 'Herida soplante sellada con parche oclusivo. Vigila la aparición de un neumotórax a tensión (p. 13).'}; } return b.neumo?.sellada ? {k: 'Revisas el parche: sigue sellado.'} : {k: 'Parche colocado.', cod: 'sin_ind'};
    case 'ncd': if (b.neumo && b.neumo.sev > .15) { b.neumo.sev = 0; b.neumo.desc++; b.neumo.tDesc = st.t; return {k: 'Descompresión en 5.º espacio intercostal, línea axilar anterior (o 2.º EIC línea medioclavicular): salida de aire, mejora la respiración y la SpO₂ (p. 15).'}; } return {ok: false, k: 'Descompresión sin salida de aire: no había neumotórax a tensión.', cod: 'sin_ind'};
    case 'digital': if (b.neumo) { b.neumo.sev = 0; b.neumo.toracost = true; b.neumo.desc++; b.neumo.tDesc = st.t; return {k: 'Toracostomía digital realizada: descompresión definitiva (p. 16).'}; } return {ok: false, k: 'Sin indicación de toracostomía.', cod: 'sin_ind'};
    case 'bvm': if (b.depresion) { b.spo2 += 10; return {k: 'Ventilas con bolsa: mejora la saturación.'}; } if (b.via?.obs) return {ok: false, k: 'No consigues ventilar: la vía aérea está obstruida.', voz: 1}; return {k: 'Ventilación asistida con bolsa.'};
    case 'oxigeno': b.o2 = true; if (b.quem) b.quem.o2 = true; return {k: 'Oxígeno administrado.'};
    case 'iv': case 'io': b.acceso = true; return {k: id === 'iv' ? 'Vía intravenosa de 18 G canalizada.' : 'Vía intraósea colocada: aspira médula y fluye bien.'};
    case 'txa': if (!b.acceso) return {ok: false, k: 'Primero necesitas una vía IV o IO.', cod: 'sin_acceso'}; b.txa++; return {k: 'Ácido tranexámico administrado. El manual no es uniforme: 1 g + 1 g (p. 7), 1-2 g antes de 3 h (p. 17), 2 g (p. 18, 26 y ficha de la p. 175). Sigue el protocolo vigente de tu unidad.'};
    case 'sangre': if (!b.acceso) return {ok: false, k: 'Primero necesitas una vía IV o IO.', cod: 'sin_acceso'}; b.sangre++; b.perd = Math.max(0, b.perd - 450); return {k: 'Unidad de sangre total administrada (unidad {0}).', a: [b.sangre]};
    case 'calcio': if (!b.acceso) return {ok: false, k: 'Primero necesitas una vía IV o IO.', cod: 'sin_acceso'}; b.calcio++; return {k: 'Gluconato cálcico 1 g IV/IO lento.'};
    case 'cristaloide': if (!b.acceso) return {ok: false, k: 'Primero necesitas una vía IV o IO.', cod: 'sin_acceso'}; b.crist += 500; return b.fuentes.some(f => f.tipo === 'int') ? {k: '500 ml de cristaloide. Atención: en hemorragia no compresible, el exceso de cristaloide favorece el resangrado (p. 17, 19).', voz: 1, cod: 'crist_mal'} : {k: '500 ml de cristaloide.'};
    case 'pulso': { const vv = v(); return vv.radial ? {k: 'Pulso radial presente, {0} lpm.', a: [vv.fc], voz: 1} : {k: 'Pulso radial ausente. Carotídeo débil a {0} lpm.', a: [vv.fc], voz: 1}; }
    case 'pulsodistal': { const f = b.fuentes.find(x => x.tqs); if (!f) return {k: 'No hay torniquete.', cod: 'sin_ind'}; return f.ctl >= .95 ? {k: 'Sin pulso distal: el torniquete es eficaz.', voz: 1} : {k: 'Todavía hay pulso distal: aprieta más o pon un segundo torniquete proximal (p. 6).', voz: 1}; }
    case 'tension': { const vv = v(); return {k: 'Tensión arterial {0}/{1} mmHg.', a: [vv.tas, Math.round(vv.tas * .62)], voz: 1}; }
    case 'spo2': return {k: 'SpO₂ {0} %.', a: [v().spo2], voz: 1};
    case 'fr': { const vv = v(); return {k: b.neumo && b.neumo.sev > .3 ? 'Respira a {0} rpm, con trabajo respiratorio aumentado.' : b.via?.obs ? 'Respira a {0} rpm, con ronquido de obstrucción.' : 'Respira a {0} rpm.', a: [vv.fr], voz: 1}; }
    case 'torax': { const n = b.neumo; if (!n) return {k: 'Tórax sin lesiones.', voz: 1}; return {k: n.abierta && !n.sellada ? 'Herida soplante en el hemitórax: burbujea al respirar.' : n.sev > .3 ? 'Murmullo abolido en un hemitórax y dificultad respiratoria creciente.' : 'El tórax ventila bien.', voz: 1}; }
    case 'reevaluar': { const vv = v(), act = b.fuentes.filter(f => f.tipo !== 'int' && f.rate * (1 - f.ctl) > 15); b.reevalT = st.t; return act.length ? {k: 'Reevaluación: sangrado activo en {0}. FC {1}, TAS {2}, SpO₂ {3} %, AVDN {4}.', a: [act.map(Z).join(', '), vv.fc, vv.tas, vv.spo2, vv.avdn], voz: 1} : {k: 'Reevaluación: intervenciones en su sitio. FC {0}, TAS {1}, SpO₂ {2} %, AVDN {3}.', a: [vv.fc, vv.tas, vv.spo2, vv.avdn], voz: 1}; }
    case 'temp': return {k: 'Temperatura {0} °C.', a: [v().temp], voz: 1};
    case 'dolor': return {k: 'Dolor {0} sobre 10.', a: [v().dolor], voz: 1};
    case 'desarmar': return vitales(b).avdn !== 'A' ? {k: 'Baja desarmada (arma y transmisiones).'} : {k: 'Le retiras el arma.', cod: 'sin_ind'};
    case 'hpmk': b.hpmk = true; return {k: 'Ropa mojada retirada; baja dentro de la manta reflectante con calentador (p. 24).'};
    case 'glasgow': { const vv = v(); b.gcsMedido = st.t; return {k: 'Glasgow {0} · AVDN: {1}.', a: [vv.gcs, vv.avdn], voz: 1}; }
    case 'pupilas': b.pupMed = st.t; return {k: 'Pupilas: {0}.', a: [v().pupilas], voz: 1};
    case 'cabeza30': b.cab30 = true; return {k: 'Cabecera elevada 30°.'};
    case 'hipertonico': if (!b.acceso) return {ok: false, k: 'Primero necesitas una vía IV o IO.', cod: 'sin_acceso'}; if (b.tce?.hern) { b.tce.hern = false; return {k: 'Suero hipertónico al 23,4 % (30 ml diluidos): mejora la anisocoria.'}; } return {k: 'Suero hipertónico administrado.', cod: b.tce ? undefined : 'sin_ind'};
    case 'mace': b.maceT = st.t; return b.mtbi ? {k: 'MACE 2: cribado positivo de conmoción (cefalea, acúfenos, memoria inmediata alterada). Reposo 24 h y comunicar (p. 28).', voz: 1} : {k: 'MACE 2: cribado negativo.', voz: 1};
    case 'collarin': return {k: 'Restricción de movimiento cervical colocada.'};
    case 'cwpp': b.analg += 3; return vitales(b).avdn !== 'A' ? {ok: false, k: 'No: la baja no puede tragar con seguridad.', cod: 'mal_med'} : {k: 'Pill pack tomado: paracetamol 1000 mg y dexketoprofeno 25 mg (p. 43).'};
    case 'otfc': case 'fentiv': case 'ketamina': {
      if (id !== 'otfc' && !b.acceso) return {ok: false, k: 'Primero necesitas una vía IV o IO.', cod: 'sin_acceso'};
      const vv = v();
      if (b.mtbi && id !== 'ketamina') return {ok: false, k: 'No uses opioides para los síntomas de una conmoción (p. 27).', cod: 'mal_med'};
      b.analg += id === 'ketamina' ? 5 : 5; if (id !== 'ketamina') b.opioide++;
      if (b.opioide >= 2) b.depresion = true;
      if (id !== 'ketamina' && (vv.tas < 90 || !vv.radial)) return {k: 'Opioide administrado con la baja en shock: riesgo de hipotensión y depresión respiratoria. En shock, la ketamina es preferible (p. 47).', cod: 'mal_med', voz: 1};
      return b.depresion ? {k: 'Tras la segunda dosis de opioide, respira muy despacio y no responde bien: depresión respiratoria.', voz: 1} : {k: id === 'ketamina' ? 'Ketamina 0,2 mg/kg IV/IO lenta en 1 minuto: el dolor cede (p. 43).' : 'Analgesia administrada; vigila la respiración (p. 43).'};
    }
    case 'ondansetron': return {k: 'Ondansetrón 4-8 mg.'};
    case 'naloxona': if (b.depresion) { b.depresion = false; b.opioide = 0; return {k: 'Naloxona: recupera la respiración espontánea.'}; } return {k: 'Naloxona administrada.', cod: 'sin_ind'};
    case 'antibiotico': b.abx = true; return {k: 'Antibiótico administrado (moxifloxacino 400 mg VO o ertapenem 1 g IV/IM).'};
    case 'ojo': b.ojoProt = true; return b.ojo ? {k: 'Protector ocular rígido sin presión sobre el globo (p. 32-33).'} : {k: 'Protector colocado.', cod: 'sin_ind'};
    case 'ferula': if (b.fractura) { b.fractura.ferula = true; b.analg += 1; return {k: 'Fractura inmovilizada en posición funcional; comprueba el estado neurovascular (p. 39).'}; } return {k: 'Férula colocada.', cod: 'sin_ind'};
    case 'apagar': if (b.quem) { b.quem.apagado = true; return {k: 'Proceso de quemadura detenido: ropa humeante retirada.'}; } return {k: 'No hay quemadura activa.', cod: 'sin_ind'};
    case 'tbsa': { if (!b.quem) return {k: 'No hay quemaduras.', cod: 'sin_ind'}; const ns = (o.frase ? numeros(o.frase) : []).filter(x => x > 0 && x <= 100); const est = ns[0]; b.quem.est = est ?? null; if (est == null) return {k: 'Di el porcentaje que estimas (por ejemplo, «regla de los nueves, 30 por ciento»).', voz: 1, cod: 'falta_dato'}; const ok = Math.abs(est - b.quem.tbsa) <= 10; return {ok, k: ok ? 'Estimación {0} %: correcta (margen ±10).' : 'Estimación {0} %: revísala; cuenta con la palma de la baja = 1 % (p. 42).', a: [est], cod: ok ? undefined : 'tbsa_mal'}; }
    case 'aposito': if (b.quem) { b.quem.cubierto = true; return {k: 'Quemaduras cubiertas con apósitos secos y estériles.'}; } return {k: 'Apósito colocado.', cod: 'sin_ind'};
    case 'regla10': { if (!b.acceso) return {ok: false, k: 'Primero necesitas una vía IV o IO.', cod: 'sin_acceso'}; if (!b.quem) return {k: 'Sin quemaduras.', cod: 'sin_ind'}; const obj = b.quem.tbsa * 10, ns = (o.frase ? numeros(o.frase) : []).filter(x => x >= 100); const r = ns[0]; b.quem.fluido = r ?? obj; const ok = r == null || Math.abs(r - obj) <= 50; return {ok, k: r == null ? 'Fluidos iniciados a {0} ml/h ({1} % × 10).' : ok ? 'Ritmo {0} ml/h: correcto ({1} % × 10).' : 'Ritmo {2} ml/h: no cuadra con la regla del 10 ({1} % × 10 = {0} ml/h).', a: [obj, b.quem.tbsa, r], cod: ok ? undefined : 'regla10_mal'}; }
    case 'c2': return {k: 'Mando informado del estado de la baja y de las necesidades de evacuación.'};
    case 'tarjeta': b.tarjeta = true; return {k: 'Tarjeta de baja rellenada y fijada a la baja.'};
    case 'camilla': b.camilla = true; return {k: 'Baja asegurada en camilla, con correa de pecho y piernas; manta remetida.'};
    case 'relevo': b.relevo = true; return {k: 'Transferencia hecha: estable/inestable, lesiones, tratamientos (especialmente los que no se ven) y tarjeta.'};
    case 'controlmed': st.controlMed = true; return {k: 'Control médico en línea: te escucha.'};
    case 'colaciono': st.colacion = st.t; return {k: 'Orden repetida en voz alta antes de ejecutarla (p. iii).'};
    case 'urgente': case 'prioritario': case 'rutina': case 'expectante': b.cat = id; if (id === 'expectante') b.marcadaExp = true; return {k: '{0} clasificada como {1}.', a: [b.id, id.toUpperCase()]};
    case 'confort': b.confort = true; return {k: 'Medidas de confort y analgesia; alguien se queda con la baja.'};
    case 'rcp': return {k: 'Compresiones torácicas iniciadas.', cod: 'rcp'};
    case 'certificar': return b.muerto || b.expectante ? {k: 'Fallecimiento certificado y hora anotada.'} : {ok: false, k: 'Tiene signos de vida.', cod: 'sin_ind'};
    case 'mascara': if (b.nrbq) b.nrbq.mask = true; return {k: 'Máscara comprobada: ajuste y sellado correctos.'};
    case 'atnaa': if (b.nrbq?.tipo === 'nervioso') { b.nrbq.atnaa++; b.nrbq.sev = clamp(b.nrbq.sev - .3, 0, 1); return {k: 'ATNAA número {0} en el muslo.', a: [b.nrbq.atnaa]}; } return {k: 'Autoinyector administrado.', cod: 'sin_ind'};
    case 'cana': if (b.nrbq) { b.nrbq.cana = true; return {k: 'CANA (diazepam 10 mg) administrado.'}; } return {k: 'Benzodiacepina administrada.', cod: 'sin_ind'};
    case 'rsdl': if (b.nrbq) { b.nrbq.decon = true; b.nrbq.sev = clamp(b.nrbq.sev - .1, 0, 1); return {k: 'Descontaminación puntual con RSDL (seco-húmedo-seco) de piel expuesta y brechas del traje.'}; } return {k: 'Descontaminación hecha.', cod: 'sin_ind'};
    case 'cyanokit': return b.nrbq?.tipo === 'cianuro' ? {k: 'Cyanokit administrado.'} : {k: 'Cyanokit administrado.', cod: 'sin_ind'};
    case 'oidos': b.oidosT = st.t; return b.timpano ? {k: 'Tímpano derecho perforado; acúfenos e hipoacusia.', voz: 1} : {k: 'Tímpanos íntegros (no descarta lesión por onda expansiva, p. 31).', voz: 1};
    case 'observar': st.obs6 = true; return {k: 'Se mantienen en observación al menos 6 horas.'};
    case 'medevac': case 'mist': return {k: 'Abre el formulario por radio.', form: id};
  }
}

/* ── inyecciones (programadas o del instructor) ── */
const INYECCIONES = ['resangrado', 'neumo', 'fuego', 'hipotermia', 'vomito', 'hernia', 'radio', 'convulsion'];
function inyecta(st, tipo, bi, prog = false) {
  const b = st.bajas[bi ?? st.act] || st.bajas[0]; const e = {t: Math.round(st.t), k: '', b: b.id, iny: tipo, prog};
  switch (tipo) {
    case 'resangrado': { const f = b.fuentes.find(x => x.tqs || x.pack) || b.fuentes[0]; if (f) { f.ctl = Math.min(f.ctl, .45); f.resangra = true; } e.k = 'Tras mover a la baja, {0} vuelve a sangrar.'; break; }
    case 'neumo': if (!b.neumo) b.neumo = {sev: .2, vel: 1 / 150, activo: true, abierta: false, sellada: false, desc: 0, tDesc: null, recurre: 0, toracost: false}; else { b.neumo.activo = true; b.neumo.desc = 0; b.neumo.sev = Math.max(b.neumo.sev, .25); } e.k = '{0} empieza con dificultad respiratoria progresiva.'; break;
    case 'fuego': st.fuego = true; st.fase = 'cuf'; st.tFuego = st.t; e.k = '¡Contacto! Fuego enemigo eficaz sobre vuestra posición.'; break;
    case 'hipotermia': b.temp -= 1.5; b.hpmk = false; e.k = 'Empieza a llover y sopla viento: {0} tirita.'; break;
    case 'vomito': b.via = b.via || {obs: false, nivel: 0, necesita: 'lateral', tObs: 0}; b.via.obs = true; b.via.necesita = b.via.necesita === 'cric' ? 'cric' : 'lateral'; e.k = '{0} vomita: gorgoteo en la vía aérea.'; break;
    case 'hernia': if (b.tce) b.tce.hern = true; e.k = '{0}: pupila derecha dilatada y postura en extensión.'; break;
    case 'radio': st.sinRadio = st.t + 120; e.k = 'Se pierde el enlace de radio durante 2 minutos.'; break;
    case 'convulsion': b.convulsion = true; e.k = '{0} empieza a convulsionar.'; break;
  }
  st.ev.push(e); return e;
}

/* ── formularios de radio por voz: 9 líneas y MIST. El código comprueba el contenido contra el escenario y contra lo que hiciste ── */
const LINEAS9 = [
  {k: 'l1', n: L3('Línea 1 · Ubicación de la zona de recogida (MGRS)', 'Line 1 · Pickup zone location (MGRS)', 'Linha 1 · Localização da zona de recolha (MGRS)')},
  {k: 'l2', n: L3('Línea 2 · Indicativo y frecuencia', 'Line 2 · Call sign and frequency', 'Linha 2 · Indicativo e frequência')},
  {k: 'l3', n: L3('Línea 3 · Número de bajas por precedencia (A urgentes, B prioritarias, C rutina)', 'Line 3 · Number of casualties by precedence (A urgent, B priority, C routine)', 'Linha 3 · Número de feridos por precedência (A urgentes, B prioritários, C rotina)')},
  {k: 'l4', n: L3('Línea 4 · Equipo especial (A ninguno, B grúa, C extracción, D respirador)', 'Line 4 · Special equipment (A none, B hoist, C extraction, D ventilator)', 'Linha 4 · Equipamento especial (A nenhum, B guincho, C extração, D ventilador)')},
  {k: 'l5', n: L3('Línea 5 · Bajas por tipo (L camilla, A ambulantes)', 'Line 5 · Casualties by type (L litter, A ambulatory)', 'Linha 5 · Feridos por tipo (L maca, A ambulatórios)')},
  {k: 'l6', n: L3('Línea 6 · Seguridad en la zona (N, P, E, X)', 'Line 6 · Security at pickup zone (N, P, E, X)', 'Linha 6 · Segurança na zona (N, P, E, X)')},
  {k: 'l7', n: L3('Línea 7 · Señalización (A paneles, B pirotecnia, C humo, D ninguna)', 'Line 7 · Marking (A panels, B pyrotechnic, C smoke, D none)', 'Linha 7 · Sinalização (A painéis, B pirotecnia, C fumo, D nenhuma)')},
  {k: 'l8', n: L3('Línea 8 · Nacionalidad / estatus', 'Line 8 · Nationality / status', 'Linha 8 · Nacionalidade / estatuto')},
  {k: 'l9', n: L3('Línea 9 · Contaminación NBQ (N, B, C o ninguna)', 'Line 9 · CBRN contamination (N, B, C or none)', 'Linha 9 · Contaminação NBQ (N, B, C ou nenhuma)')}
];
const MIST = [
  {k: 'M', n: L3('M · Mecanismo y hora de la lesión', 'M · Mechanism and time of injury', 'M · Mecanismo e hora da lesão')},
  {k: 'I', n: L3('I · Lesiones', 'I · Injuries', 'I · Lesões')},
  {k: 'S', n: L3('S · Signos y síntomas (vía aérea, respiración, pulso, conciencia)', 'S · Signs and symptoms (airway, breathing, pulse, consciousness)', 'S · Sinais e sintomas (via aérea, respiração, pulso, consciência)')},
  {k: 'T', n: L3('T · Tratamientos aplicados', 'T · Treatments given', 'T · Tratamentos aplicados')}
];
const _letra = s => { const m = (' ' + normz(s) + ' ').match(/ (a|b|c|d|e|n|p|x|l|alfa|alpha|bravo|charlie|delta|echo|eco|november|papa|x ray|xray) /); const map = {alfa: 'a', alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', eco: 'e', november: 'n', papa: 'p', 'x ray': 'x', xray: 'x'}; return m ? (map[m[1]] || m[1]) : null; };
/* lo que el escenario espera: precedencias y tipos según el triaje correcto, seguridad, NBQ */
function esperado9(st, esc) {
  const vivos = st.bajas.filter(b => !b.muerto && b.catOk !== 'expectante');
  const cnt = c => vivos.filter(b => (b.catOk || 'urgente') === c).length;
  return {A: cnt('urgente'), B: cnt('prioritario'), C: cnt('rutina'), L: vivos.filter(b => !b.camina).length, Amb: vivos.filter(b => b.camina).length, seg: esc.seg || 'n', nbq: esc.nbq || 'ninguna'};
}
function valida9(st, esc, r) {
  const E = esperado9(st, esc), o = {};
  o.l1 = /\d{3,}/.test(r.l1 || '') ? [true, 'Coordenadas registradas.'] : [false, 'Faltan coordenadas (cifras de la cuadrícula).'];
  o.l2 = /\d/.test(r.l2 || '') && normz(r.l2).length > 3 ? [true, 'Indicativo y frecuencia registrados.'] : [false, 'Falta el indicativo o la frecuencia.'];
  { const s = normz(r.l3 || ''), get = L => { const m = s.match(new RegExp('(?:^| )' + L + ' (\\w+)')) || s.match(new RegExp('(\\w+) ' + ({a: 'urgentes?|urgent', b: 'prioritari[oa]s?|priority', c: 'rutinas?|routine|rotina'}[L]))); if (!m) return null; const n = numeros(m[1]); return n.length ? n[0] : null; };
    const a = get('a') ?? get('alfa') ?? get('alpha'), b = get('b') ?? get('bravo'), c = get('c') ?? get('charlie');
    const ok = (a ?? 0) === E.A && (b ?? 0) === E.B && (c ?? 0) === E.C && (a != null || b != null || c != null);
    o.l3 = ok ? [true, 'Precedencias correctas.'] : [false, 'Precedencias esperadas: A {0} · B {1} · C {2} (p. 2, 56).', [E.A, E.B, E.C]]; }
  o.l4 = _letra(r.l4) || /ninguno|none|nenhum|grua|hoist|guincho|respirador|ventilator|ventilador|extracc|extraction/.test(normz(r.l4 || '')) ? [true, 'Equipo especial registrado.'] : [false, 'Indica la letra del equipo especial.'];
  { const s = normz(r.l5 || ''), m1 = s.match(/(?:l|lima|litter|camilla|maca)s? (\w+)/), m2 = s.match(/(?:a|amb|ambulantes?|ambulatory|ambulatorios?) (\w+)/), m1b = s.match(/(\w+) (?:en )?(?:camillas?|litters?|macas?)/), m2b = s.match(/(\w+) (?:ambulantes?|ambulatory|ambulatorios?)/);
    const nL = (m1 && numeros(m1[1])[0]) ?? (m1b && numeros(m1b[1])[0]), nA = (m2 && numeros(m2[1])[0]) ?? (m2b && numeros(m2b[1])[0]);
    o.l5 = (nL ?? 0) === E.L && (nA ?? 0) === E.Amb && (nL != null || nA != null) ? [true, 'Tipos correctos.'] : [false, 'Esperado: {0} en camilla y {1} ambulantes (p. 56).', [E.L, E.Amb]]; }
  { const l = _letra(r.l6), s = normz(r.l6 || ''), g = l || (/sin enemigo|no enemy|sem inimigo|ninguno|none/.test(s) ? 'n' : /posible|possible|possivel/.test(s) ? 'p' : /escolta|escort/.test(s) ? 'x' : /enemigo|enemy|inimigo/.test(s) ? 'e' : null);
    o.l6 = g === E.seg ? [true, 'Seguridad correcta.'] : [false, 'Según la situación, la seguridad es «{0}».', [E.seg.toUpperCase()]]; }
  o.l7 = (r.l7 || '').trim() ? [true, 'Señalización registrada.'] : [false, 'Falta la señalización.'];
  o.l8 = (r.l8 || '').trim() ? [true, 'Nacionalidad registrada.'] : [false, 'Falta la nacionalidad.'];
  { const s = normz(r.l9 || ''), quim = /quimic|chemical|c |^c$/.test(s + ' '), nada = /ninguna|ninguno|none|nenhuma|negativ|limpio|clean|sin contaminacion/.test(s);
    const ok = E.nbq === 'ninguna' ? nada || (!quim && s.length > 0) : quim;
    o.l9 = ok ? [true, 'NBQ correcta.'] : [false, 'Contaminación esperada: {0}.', [E.nbq]]; }
  return o;
}
/* MIST: los tratamientos que dices deben coincidir con lo que hiciste (en ambos sentidos) */
const TRATS = ['tq', 'tq2', 'empaquetar', 'tqunion', 'pelvica', 'npa', 'cric', 'sga', 'sello', 'ncd', 'digital', 'iv', 'io', 'txa', 'sangre', 'calcio', 'otfc', 'ketamina', 'fentiv', 'atnaa', 'cana', 'hpmk', 'antibiotico', 'hipertonico', 'regla10'];
function validaMist(st, esc, r, bi = st.act) {
  const b = st.bajas[bi], lang = st.lang, o = {};
  const mec = tx3(esc.mec, lang).split('|').map(normz).filter(Boolean), les = tx3(esc.lesKw, lang).split('|').map(normz).filter(Boolean);
  const sM = ' ' + normz(r.M) + ' ', sI = ' ' + normz(r.I) + ' ';
  o.M = mec.some(k => sM.includes(' ' + k)) ? [true, 'Mecanismo correcto.'] : [false, 'El mecanismo no coincide con el escenario.'];
  o.I = les.some(k => sI.includes(' ' + k)) ? [true, 'Lesiones identificadas.'] : [false, 'No mencionas la lesión principal.'];
  o.S = numeros(r.S || '').length >= 1 ? [true, 'Constantes transmitidas.'] : [false, 'Da al menos una constante con su cifra (pulso, FR, SpO₂, AVDN).'];
  const hechos = [...new Set(st.log.filter(l => l.b === b.id && l.ok && !l.fuera && TRATS.includes(l.a)).map(l => l.a === 'tq2' ? 'tq' : l.a))];
  const dichos = interpreta(r.T || '', lang).filter(a => TRATS.includes(a)).map(a => a === 'tq2' ? 'tq' : a);
  const falta = hechos.filter(a => !dichos.includes(a)), sobra = dichos.filter(a => !hechos.includes(a));
  o.T = !falta.length && !sobra.length && (hechos.length || (r.T || '').trim()) ? [true, 'Tratamientos coherentes con lo que hiciste.'] : [false, 'Tratamientos: falta {0}; dices sin haberlo hecho {1}.', [falta.map(a => a).join(', ') || '—', sobra.join(', ') || '—'], {falta, sobra}];
  return o;
}

/* ── rúbrica ── (cada punto: {id, txt, p, crit, min, max, chk}) */
const tLog = (st, a, b) => st.log.find(l => (Array.isArray(a) ? a.includes(l.a) : l.a === a) && l.ok && !l.fuera && (b == null || l.b === b));
const CHK = {
  hecho: (st, c) => { const l = tLog(st, c.a, c.b); return !!l && (c.antes == null || l.t <= c.antes); },
  orden: (st, c) => { const x = tLog(st, c.a, c.b), y = st.log.find(l => (Array.isArray(c.y) ? c.y.includes(l.a) : l.a === c.y) && (c.b == null || l.b === c.b)); return !!x && (!y || x.t <= y.t); },
  nunca: (st, c) => !st.log.some(l => (Array.isArray(c.a) ? c.a.includes(l.a) : l.a === c.a) && (c.fase == null || l.fase === c.fase) && (c.b == null || l.b === c.b)),
  tras: (st, c) => { const x = tLog(st, c.y, c.b); return !!x && st.log.some(l => (Array.isArray(c.a) ? c.a.includes(l.a) : l.a === c.a) && l.t >= x.t && (c.b == null || l.b === c.b)); },
  vivo: (st, c) => st.bajas.filter(b => c.b == null || b.id === c.b).every(b => !b.muerto),
  triaje: (st, c) => st.bajas.every(b => !b.catOk || b.cat === b.catOk),
  cat: (st, c) => { const b = st.bajas.find(x => x.id === c.b); return !!b && b.cat === c.cat; },
  dec: (st, c) => st.dec[c.d] === c.ok,
  form: (st, c) => { const f = st.form[c.f]; return !!f && f.fin && Object.values(f.val || {}).filter(v => v[0]).length >= (c.min ?? Object.keys(f.val || {}).length); },
  campo: (st, c) => { const f = st.form[c.f]; return !!f && f.fin && !!(f.val?.[c.k]?.[0]); },
  sinFuera: st => !st.log.some(l => l.fuera),
  cuenta: (st, c) => st.log.filter(l => l.a === c.a && l.ok && !l.fuera && (c.b == null || l.b === c.b)).length >= c.n,
  estado: (st, c) => { const b = st.bajas.find(x => x.id === (c.b || st.bajas[0].id)); return !!b && !!c.fn(b, st); },
  sinCod: (st, c) => !st.log.some(l => l.cod === c.cod && (c.b == null || l.b === c.b))
};
function rubrica(st, esc) {
  const gen = [
    {id: 'g_vivo', txt: L3('Todas las bajas recuperables siguen vivas al final', 'All salvageable casualties are alive at the end', 'Todos os feridos recuperáveis estão vivos no final'), p: '2', crit: true, chk: {t: 'estado', fn: (b, s) => s.bajas.every(x => x.expectante || !x.muerto)}},
    {id: 'g_alcance', txt: L3('Ninguna acción fuera del alcance de tu nivel', 'No action outside your level\'s scope', 'Nenhuma ação fora do alcance do seu nível'), p: 'ii', crit: true, chk: {t: 'sinFuera'}}
  ];
  const items = [...gen, ...esc.rub].filter(it => (it.min ?? 0) <= st.niv && (it.max ?? 3) >= st.niv);
  const res = items.map(it => ({id: it.id, txt: it.txt, p: it.p, crit: !!it.crit, ok: !!CHK[it.chk.t](st, it.chk)}));
  const pts = res.reduce((s, r) => s + (r.ok ? (r.crit ? 2 : 1) : 0), 0), max = res.reduce((s, r) => s + (r.crit ? 2 : 1), 0);
  const fallosCrit = res.filter(r => r.crit && !r.ok);
  return {items: res, pts, max, pct: max ? Math.round(pts / max * 100) : 0, apto: !fallosCrit.length && pts / max >= .7, fallosCrit: fallosCrit.length};
}

/* reloj de fuego (CUF): sin devolver fuego ni ponerse a cubierto en 30 s, el sanitario se convierte en baja */
function controlFuego(st) {
  if (st.fase === 'cuf' && st.fuego && !st.cubierto && !st.herido && st.t - st.tFuego > 30) { st.herido = true; st.ev.push({t: st.t, k: 'Te expones al fuego sin cubrirte: recibes un impacto. Ahora eres una baja más (p. 4).', b: '—'}); st.log.push({t: Math.round(st.t), a: '_herido', b: '—', fase: 'cuf'}); }
}

if (typeof module !== 'undefined') module.exports = {ACC, ACC_IDS, NIVELES, NIV, L3, tx3, normz, numeros, interpreta, meta, nuevaBaja, vitales, tick, nuevaSesion, ejecuta, inyecta, INYECCIONES, LINEAS9, MIST, valida9, validaMist, esperado9, rubrica, controlFuego, hemorragiaActiva, bajaAct, CHK};
