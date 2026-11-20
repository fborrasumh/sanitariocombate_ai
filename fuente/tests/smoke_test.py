"""Pruebas de SanitarIA de Combate en Chromium (Playwright), sin claves reales: python3 tests/smoke_test.py"""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from forja_test import Harness
R = pathlib.Path(__file__).resolve().parent.parent; OUT = R / 'tests' / 'out'; OUT.mkdir(exist_ok=True)
fallos = []
def ok(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fallos.append(m)

async def reply(prov, system, user, info):
    if 'motor de interpretación' in user:   # IA simulada: una orden válida + una INVENTADA que el código debe descartar
        return ('j', {'acciones': ['tq', 'inyectar_morfina_magica'], 'respuesta': '¡Aprieta fuerte, me desangro!', 'rol': 'baja'})
    if 'consejos' in user:   # comentario de debriefing: una página válida y otra INVENTADA
        return ('j', {'consejos': [{'texto': 'Marca siempre la hora del torniquete.', 'p': '8'}, {'texto': 'Consulta el anexo secreto.', 'p': '999'}]})
    return ('j', {})

async def main():
    async with Harness(R / 'index.html', reply) as h:
        p = h.page
        print('1) Carga e idiomas')
        ok(not h.errors, 'sin errores de JavaScript al cargar: ' + '; '.join(h.errors[:3]))
        ok(await h.faltan_traducciones() == [], 'i18nFaltan() vacío')
        ok(await h.csp_bloquea(), 'la CSP bloquea orígenes no declarados')
        await h.shot(str(OUT / 'portada.png'), full=False)

        print('2) Ejemplo automático sin clave (BajoFuego por voz simulada)')
        await p.click('#btnEjemplo')
        await h.esp("step === 3", n=240, ms=250)
        txt = await p.inner_text('#debrief')
        ok('APTO' in txt and 'NO APTO' not in txt, 'el ejemplo acaba en APTO')
        await h.shot(str(OUT / 'debrief_ejemplo.png'))

        print('3) Nivel ASM en TóraxTáctico, órdenes habladas y una fuera de nivel')
        await p.evaluate("go(1)"); await p.click('[data-niv=ASM]'); await p.click('[data-esc=torax]'); await p.select_option('#selVel', '4')
        await p.click('#btnComenzar'); await p.wait_for_timeout(600)
        for f in ['barrido de cabeza a pies', 'exploro el tórax', 'pongo un parche torácico', 'canalizo una vía venosa', 'informo al mando', 'manta térmica']:
            await p.evaluate("t => window.simulaVoz(t)", f); await p.wait_for_timeout(250)
        log = await p.inner_text('#log')
        ok('fuera del alcance de tu nivel' in log, 'ASM: la vía venosa se rechaza por nivel')
        ok('Herida soplante sellada' in log, 'el parche se aplica por voz')
        await h.shot(str(OUT / 'simulacion.png'), full=False)
        await p.evaluate("t => window.simulaVoz(t)", 'fin de la simulación'); await h.esp("step === 3")
        txt = await p.inner_text('#debrief')
        ok('NO APTO' in txt and 'Ninguna acción fuera del alcance' in txt, 'el fallo de nivel es crítico → NO APTO')
        await h.descarga('#btnJson', str(OUT / 'res_asm.json')); res = json.loads((OUT / 'res_asm.json').read_text())
        ok(res['nivel'] == 'ASM' and any(l['fuera'] for l in res['log']), 'JSON para el instructor con el registro')
        await h.descarga('#btnWord', str(OUT / 'debrief.docx')); ok((OUT / 'debrief.docx').stat().st_size > 3000, 'informe Word generado sin red')

        print('4) Petición de 9 líneas por voz en EvacuaciónTáctica (nivel CLS)')
        await p.evaluate("go(1)"); await p.click('[data-niv=CLS]'); await p.click('[data-esc=evac]'); await p.click('#btnComenzar'); await p.wait_for_timeout(400)
        await p.evaluate("SIM.st.t = 40"); await p.wait_for_timeout(1300)
        await p.evaluate("t => window.simulaVoz(t)", 'opción A')
        for f in ['pido medevac', '30S YH 1234 5678', 'Halcón 2 frecuencia 45.250', 'A uno, B uno', 'A ninguno', 'L dos, A cero', 'papa', 'charlie humo verde', 'alfa', 'ninguna']:
            await p.evaluate("t => window.simulaVoz(t)", f); await p.wait_for_timeout(120)
        log = await p.inner_text('#log')
        ok('todo correcto' in log, '9 líneas validadas por código: ' + log[-200:].replace('\n', ' '))
        await p.evaluate("t => window.simulaVoz(t)", 'fin de la simulación'); await h.esp("step === 3")

        print('5) IA simulada para frases libres (descarta órdenes inventadas)')
        await p.evaluate("localStorage.setItem(PROV.openai.k,'sk-test-clave-larga-de-prueba-123'); S.ia = true; go(1)")
        await p.click('[data-niv=CMC]'); await p.click('[data-esc=cuf]'); await p.select_option('#selVel', '1'); await p.click('#btnComenzar'); await p.wait_for_timeout(1300)
        await p.evaluate("t => window.simulaVoz(t)", 'opción A'); await p.evaluate("t => window.simulaVoz(t)", 'devuelvo fuego')
        await p.evaluate("t => window.simulaVoz(t)", 'cierra eso de la pierna como sea, rápido')
        await p.wait_for_selector('#mEnvio.on'); await p.check('#envioOk'); await p.click('#envioSi')
        await p.wait_for_timeout(900); log = await p.inner_text('#log')
        ok('Interpretado por la IA como: Torniquete' in log, 'la orden válida propuesta por la IA se ejecuta')
        ok('inyectar_morfina_magica' in log and 'descartado' in log, 'la orden inventada se descarta y se avisa')
        await p.evaluate("t => window.simulaVoz(t)", 'fin de la simulación'); await h.esp("step === 3")
        await p.click('#btnIADeb'); await p.wait_for_timeout(900); ia = await p.inner_text('#iaDebTxt')
        ok('✓ p. 8' in ia and '999' in ia and 'no está en esta sesión' in ia, 'debriefing IA: la página inventada se marca')

        print('6) Instructor: reunir resultados')
        await p.evaluate("go(4)"); await p.set_input_files('#iFiles', [str(OUT / 'res_asm.json')]); await p.wait_for_timeout(300)
        ok('ASM' in await p.inner_text('#iTabla'), 'tabla del grupo con el resultado importado')
        await h.shot(str(OUT / 'instructor.png'))

        print('7) Idiomas: cada pantalla repinta sin errores')
        for l in ['en', 'pt']:
            await h.idioma(l)
            for s in [0, 1, 5, 6, 4]: await p.evaluate(f"go({s})"); await p.wait_for_timeout(80)
            await p.evaluate("go(1)"); await p.click('[data-niv=CMC]'); await p.click('[data-esc=hem]'); await p.click('#btnComenzar'); await p.wait_for_timeout(300)
            frase = {'en': 'apply a tourniquet', 'pt': 'coloco um torniquete'}[l]
            await p.evaluate("t => window.simulaVoz(t)", frase); await p.wait_for_timeout(200)
            log = await p.inner_text('#log'); ok(('Tourniquet' in log or 'Torniquete' in log) and 'forearm' in log if l == 'en' else 'antebraço' in log, f'{l}: orden reconocida y respuesta en su idioma')
            await h.shot(str(OUT / f'sim_{l}.png'), full=False)
            await p.evaluate("finaliza()"); await p.wait_for_timeout(200)
        await h.idioma('es')
        ok(not h.errors, 'sin errores de JavaScript en todo el recorrido: ' + '; '.join(h.errors[:3]))

    print('8) Móvil y sin red')
    async with Harness(R / 'index.html', reply, viewport=(390, 844)) as h:
        p = h.page
        await h.ctx.set_offline(True)
        await p.click('#btnEjemplo'); await p.wait_for_timeout(3500)
        ok(await p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), 'sin desborde horizontal en móvil durante la simulación')
        await h.shot(str(OUT / 'movil_sim.png'), full=False)
        await h.esp("step === 3", n=240)
        ok('APTO' in await p.inner_text('#debrief'), 'sin red: el ejemplo funciona completo')
        await h.shot(str(OUT / 'movil_debrief.png'), full=False)
        ok(not h.errors, 'móvil sin errores: ' + '; '.join(h.errors[:3]))
    print(f'\n{len(fallos)} fallo(s)' if fallos else '\nTodo correcto')
    sys.exit(1 if fallos else 0)
asyncio.run(main())
