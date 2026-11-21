# SanitarIA de Combate

Simulador por voz de atención táctica a bajas (TCCC). Es una aplicación web de un solo fichero, en español, inglés y portugués.

**Usar la app:** https://fborrasumh.github.io/sanitariocombate_ai/ (idioma: `?lang=en` / `?lang=pt`)

> **Herramienta formativa.** No sustituye el juicio clínico-táctico, los protocolos nacionales ni la supervisión docente. Ningún contenido debe aplicarse a pacientes ni a operaciones reales. Verifica siempre con los protocolos vigentes de tu unidad.

## Qué hace

- **15 escenarios**, los mismos módulos que la versión 1:
  - Fase 1: BajoFuego, HemorragiaX.
  - Fase 2: VíaAéreaTáctica, TóraxTáctico, ShockCombate, HipotermiaTCE.
  - Fase 3: TriajeTáctico, EvacuaciónTáctica, InformeTáctico.
  - Módulos especiales: AnalgesiaCombate, QuemadurasTácticas, BlastInjury, NRBQ, CampoTáctico, MandoMédico.
- **4 niveles**: todo combatiente (ASM), socorrista de combate (CLS), sanitario de combate (CMC) y médico o enfermero (CPP). El nivel decide qué órdenes se ejecutan y qué puntos de la rúbrica se exigen. Una orden fuera de nivel no se ejecuta, se explica a quién pedirla y cuenta como fallo crítico.
- **Todo por voz.** El reconocimiento y la síntesis los hace el propio navegador (Web Speech API), sin coste:
  - Funciona en modo «pulsar para hablar» (también manteniendo la barra espaciadora) y en modo «manos libres».
  - La baja, el instructor y la radio hablan con voces distintas.
  - Las 70 órdenes tienen varias formas de decirse en cada idioma. Las decisiones se responden con «opción A»; la petición de 9 líneas y el MIST se dictan línea a línea por radio.
- **Fisiología y reloj por código.** Para cada baja se calcula, segundo a segundo:
  - pérdida de sangre por fuente (extremidad, unión, interna);
  - neumotórax a tensión, que reaparece si no se trata de forma definitiva;
  - obstrucción de la vía aérea;
  - hipotermia, con coagulopatía añadida;
  - TCE con herniación;
  - intoxicación por agente nervioso;
  - depresión respiratoria por opioides.

  Las constantes solo se ven cuando se miden.
- **Rúbrica calculada por código**, con una lista de puntos por escenario que se comprueba contra el registro de la sesión. Los puntos críticos valen doble; el APTO exige un 70 % y ningún fallo crítico.
- **El código comprueba lo que dices por radio:**
  - En las 9 líneas, las precedencias, los tipos de baja, la seguridad y la contaminación NBQ se contrastan con el escenario.
  - En el MIST, los tratamientos que declaras se contrastan con lo que hiciste. Detecta tanto lo omitido como lo inventado.
- **Modo instructor (sin servidor):**
  - un código de sesión común (`escenario.nivel.velocidad`, o un enlace `?s=`);
  - una consola para inyectar complicaciones (resangrado, neumotórax, fuego, frío, vómito, herniación, pérdida de radio, convulsión);
  - la agregación de los JSON del grupo, con la dificultad de cada punto y exportación a CSV.
- **Ejemplo automático sin clave de IA**, que también funciona sin red una vez cargado.
- **Debriefing** con rúbrica, línea de tiempo y estado final. Se descarga en Word, en JSON para el instructor y en CSV. Las descargas se generan en el navegador, sin librerías externas.

## Cómo se usa la IA (opcional)

Con la clave propia de OpenAI, Google Gemini o Anthropic Claude, guardada solo en el navegador. Hay dos usos:

1. **Frases que el catálogo no reconoce.** La IA propone identificadores de órdenes y el código ejecuta solo los que existen en el catálogo; los inventados se descartan y se avisa. También puede contestar en el papel de la baja, sin contradecir el estado que calcula el código.
2. **Comentario de debriefing.** La IA redacta consejos anclados a un punto de la rúbrica, y el código comprueba que ese punto existe en la sesión.

**La IA nunca pone la nota.** Antes del primer envío se muestra lo que sale del equipo.

## Privacidad

- **Lo que se queda en el navegador (IndexedDB):** historial, resultados, seudónimo y clave.
- **La voz** va al servicio de reconocimiento del navegador: Google en Chrome, Microsoft en Edge, Apple en Safari. No se deben decir datos reales.
- **Si se activa la IA**, salen las frases no reconocidas y el resumen del debriefing, nunca el seudónimo.

## Límites

- Es un modelo fisiológico **docente y simplificado**, construido con las clases de shock hemorrágico y la estimación de la tensión por los pulsos. No es un simulador validado.
- **Ácido tranexámico.** Las pautas varían entre protocolos (1 g + 1 g, o 2 g). La app avisa y no elige.
- **Niveles.** ASM, CLS, CMC y CPP son niveles del CoTCCC; el alcance de cada orden es una propuesta y **debe revisarlo el equipo docente**.
- **Voz.**
  - Firefox no tiene reconocimiento de voz: allí hay que escribir.
  - En Chrome y Edge el reconocimiento necesita red.
  - Con ruido intenso, la transcripción empeora.
  - La voz real no se ha probado de forma automática: las pruebas simulan la frase transcrita.
- **IA.** No se ha probado con una clave real; las pruebas usan respuestas simuladas.

## Versión 1

Los 15 simuladores de chat de la versión 1.0.0 siguen en sus direcciones originales (`care-under-fire.html`, …). Su índice está en [`v1/`](v1/index.html).

## Autoría

Fernando Borrás Rocher (Universidad Miguel Hernández de Elche) · ORCID [0000-0002-5519-4573](https://orcid.org/0000-0002-5519-4573)

## Cómo citar

Borrás Rocher, F. (2026). *SanitarIA de Combate* (v2.0.0) [Software]. Universidad Miguel Hernández de Elche. https://doi.org/10.5281/zenodo.21423210

## Licencia

MIT. Véase [LICENSE](LICENSE).
