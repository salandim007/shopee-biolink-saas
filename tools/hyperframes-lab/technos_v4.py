#!/usr/bin/env python3
"""Technos V4: isolated marketing preview using the existing pilot, TTS and renderer.

Run on the VPS: python3 technos_v4.py --render
Reads the selected Technos job; never changes that job or the original pilot.
Creates a new run, writes provenance, synthesizes NEW Dora narration, renders one
job at a time, probes the MP4 and extracts review frames. Human approval required.
This pilot uses an explicit editorial plan, not a newly generated Qwen plan.
"""
import argparse
import fcntl
import hashlib
import html
import importlib.util
import json
import os
import signal
from pathlib import Path
import subprocess
import sys
import time
import uuid

LAB = Path('/home/admin/hyperframes-lab')
DEFAULT_JOB = Path('/opt/shopee-biolink-homologacao/data/creative-studio/jobs/0551cff8-37a9-4565-9fd2-6423a09da46f/job.json')
ITEM = '11854695020'
SHOP = '544907177'
PHRASES = [
    'Technos Golf. Estilo em destaque.',
    'Modelo masculino de estilo clássico.',
    'Prateado para compor seu visual.',
    'Conheça o modelo 2115TU/1P.',
    'Confira na vitrine Mix de Produtos.',
]
LAYOUTS = ['hero', 'split', 'focus', 'editorial', 'closing']


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def load_pilot():
    folder = LAB / 'agente-video-piloto'
    sys.path.insert(0, str(folder))
    spec = importlib.util.spec_from_file_location('mix_existing_pilot', folder / 'diretor_ia.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def tts_with_logs(pilot, run_dir, plan, timeout=300):
    """Wrap only the existing TTS command; log and terminate its own process group."""
    original = pilot.exec_cmd
    counter = 0

    def logged_command(argv, **kwargs):
        nonlocal counter
        if 'tts' not in argv or not any(Path(str(a)).name == 'hyperframes' for a in argv):
            return original(argv, **kwargs)
        counter += 1
        logfile = run_dir / f'tts-{counter:02d}.log'
        print(f'[TTS LOG] {logfile} (limite: {timeout}s)', flush=True)
        with logfile.open('w', encoding='utf-8') as output:
            process = subprocess.Popen(argv, stdout=output, stderr=subprocess.STDOUT,
                                       env=kwargs.get('env'), start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
            except BaseException:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
                raise
        if code:
            raise RuntimeError(f'TTS terminou com codigo {code}. Consulte {logfile}.')
        return subprocess.CompletedProcess(argv, code)

    pilot.exec_cmd = logged_command
    try:
        return pilot.tts(run_dir, plan)
    finally:
        pilot.exec_cmd = original


def plan_for_job(job):
    product = job.get('product', {})
    if str(product.get('itemId')) != ITEM or str(product.get('shopId')) != SHOP:
        raise ValueError('Este piloto foi escrito somente para o Technos selecionado.')
    title = str(product.get('title', ''))
    if not all(word in title.lower() for word in ['technos', 'golf', '2115tu/1p', 'prateado', 'masculino', 'classic']):
        raise ValueError('O titulo atual nao sustenta os fatos usados neste roteiro.')
    images = job.get('images')
    if not isinstance(images, list) or len(images) != 5 or not all(isinstance(x, str) for x in images) or len(set(images)) != 5:
        raise ValueError('Este piloto exige as cinco fotografias distintas selecionadas.')
    entry = {'produto': {'item_id': ITEM, 'shop_id': SHOP, 'titulo': title,
             'fatos_confirmados': ['Titulo do catalogo identifica relogio masculino Technos Golf.',
                                   'Titulo do catalogo informa estilo Classic.',
                                   'Titulo do catalogo informa Prateado.',
                                   'Titulo do catalogo identifica modelo 2115TU/1P.'],
             'imagens': [{'id': f'imagem_{i+1}', 'url': url} for i, url in enumerate(images)]}}
    evidence = [[], ['f0', 'f1'], ['f2'], ['f3'], []]
    plan = {'conceito_criativo': 'Technos Golf: produto em primeiro plano e tipografia cinetica',
            'justificativa': 'Apresentar identidade, estilo e modelo; encerrar com convite a vitrine.',
            'estilo_visual': 'tecnologico',
            'paleta': {'fundo': '#071A30', 'destaque': '#18D99B', 'texto': '#FFFFFF'},
            'cenas': [{'papel': ('capa' if i == 0 else 'cta' if i == 4 else 'beneficio'),
                       'fala_legenda': phrase, 'midia_referencia': f'imagem_{i+1}',
                       'evidencia_ids': evidence[i], 'direcao_visual': LAYOUTS[i],
                       'movimento': 'revelar'} for i, phrase in enumerate(PHRASES)]}
    return entry, plan


CSS = '''
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#071a30;overflow:hidden}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;font-family:Arial,sans-serif;color:#fff;background:linear-gradient(145deg,#071a30,#073c64)}
.brand{position:absolute;z-index:30;top:185px;left:84px;font-size:28px;letter-spacing:5px;font-weight:700}
.brand b{color:#18d99b}.scene{position:absolute;inset:0;visibility:hidden;overflow:hidden;background:linear-gradient(145deg,#071a30,#073c64)}
.label{position:absolute;left:84px;top:270px;font-size:25px;letter-spacing:4px;color:#61ecc0}
.copy{position:absolute;left:84px;right:184px;top:350px;font-size:83px;font-weight:900;line-height:1.06;letter-spacing:-2px}
.word{display:inline-block;margin-right:.22em}.word:last-child{color:#61ecc0}
.photo-card{position:absolute;left:84px;top:730px;width:812px;height:690px;background:#fff;border-radius:48px;overflow:hidden;box-shadow:0 35px 70px #0005}
.photo{position:absolute;inset:28px;width:calc(100% - 56px);height:calc(100% - 56px);object-fit:contain}
.badge{position:absolute;top:1490px;left:84px;right:184px;font-size:28px;letter-spacing:2px;color:#a4c7df}
.geometry{position:absolute;left:25px;top:640px;width:930px;height:890px;opacity:.65;pointer-events:none}
.line{stroke:#18d99b;stroke-width:4;fill:none;stroke-dasharray:1600;stroke-dashoffset:1600}
.orb{fill:#18d99b}.index{position:absolute;left:84px;top:490px;font-size:220px;font-weight:900;color:#18d99b22}
.split .copy{top:1060px;font-size:78px}.split .photo-card{left:190px;top:355px;width:706px;height:650px}.split .index{top:690px;left:65px}
.focus .copy{top:340px;font-size:80px}.focus .photo-card{top:650px;height:720px;border-radius:180px 48px 48px 48px}
.focus .badge{top:1430px;padding:24px 28px;border-left:6px solid #18d99b;background:#061c30}
.editorial .copy{top:1190px;font-size:73px}.editorial .photo-card{top:345px;height:770px;border-radius:48px 180px 48px 48px}.editorial .badge{top:1500px}
.closing .photo-card{top:350px;left:235px;width:510px;height:570px;border-radius:40px}.closing .copy{top:1010px;font-size:78px}
.closing .badge{top:1395px;background:#18d99b;color:#052338;border-radius:24px;padding:29px 30px;font-weight:900;text-align:center}
.footer{position:absolute;z-index:30;left:84px;right:184px;top:1580px;font-size:23px;letter-spacing:3px;color:#b3cbdc}
'''


def build_html(plan, timings, sources, run_dir):
    blocks, animations = [], []
    badges = ['TECHNOS GOLF', 'ESTILO CLASSIC', 'VISUAL PRATEADO', 'MODELO 2115TU/1P', 'CONHEÇA NA VITRINE  →']
    for i, scene in enumerate(plan['cenas']):
        image = html.escape(sources[scene['midia_referencia']], quote=True)
        words = ' '.join('<span class="word">' + html.escape(w) + '</span>' for w in scene['fala_legenda'].split())
        blocks.append(f'''<section id="s{i}" class="scene {LAYOUTS[i]}">
<div class="label">{'EM DESTAQUE' if i == 0 else 'CONFIRA' if i == 4 else 'DETALHES DO MODELO'}</div>
<div class="index">0{i+1}</div>
<svg class="geometry" viewBox="0 0 930 890"><path class="line" d="M30 300 L30 45 L330 45 M600 845 L890 845 L890 560"/><circle class="orb" cx="890" cy="560" r="9"/></svg>
<div class="photo-card"><img class="photo" src="{image}" alt="Fotografia real do Technos Golf"></div>
<div class="copy">{words}</div><div class="badge">{badges[i]}</div></section>''')
        start = 0 if i == 0 else max(0, timings[i]['inicio_s'] - .12)
        end = 15 if i == 4 else max(start + .5, timings[i+1]['inicio_s'] - .12)
        # Hard scene boundaries prevent the next card from hiding unfinished speech.
        animations += [
            f"t.set('#s{i}',{{autoAlpha:1}},{start:.3f});",
            f"t.fromTo('#s{i} .photo-card',{{y:55,scale:.96}},{{y:0,scale:1,duration:.55,ease:'power3.out',immediateRender:false}},{start:.3f});",
            f"t.fromTo('#s{i} .word',{{y:28,opacity:0}},{{y:0,opacity:1,duration:.22,stagger:.035,ease:'power3.out',immediateRender:false}},{start:.3f});",
            f"t.fromTo('#s{i} .line',{{strokeDashoffset:1600}},{{strokeDashoffset:0,duration:.8,ease:'power2.out',immediateRender:false}},{start:.3f});",
            f"t.fromTo('#s{i} .badge',{{x:-20,opacity:0}},{{x:0,opacity:1,duration:.3,immediateRender:false}},{start+.18:.3f});",
        ]
        if i < 4:
            animations.append(f"t.set('#s{i}',{{autoAlpha:0}},{end:.3f});")
    page = '''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Technos Golf V4</title>
<style>__CSS__</style></head><body><div id="root" data-composition-id="mix-technos-v4" data-duration="15" data-start="0" data-width="1080" data-height="1920">
__BLOCKS__<div class="brand">MIX <b>DE PRODUTOS</b></div><div class="footer">CONFIRA O PRODUTO NA VITRINE</div></div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><script>
if(typeof gsap==='undefined')throw new Error('GSAP indisponivel');
const t=gsap.timeline({paused:true});
__ANIMATIONS__
t.to({}, {duration:.01},14.99);window.__timelines=window.__timelines||{};window.__timelines['mix-technos-v4']=t;
</script></body></html>'''
    page = page.replace('__CSS__', CSS).replace('__BLOCKS__', '\n'.join(blocks)).replace('__ANIMATIONS__', '\n'.join(animations))
    folder = run_dir / 'composicao'
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'index.html').write_text(page, encoding='utf-8')
    write_json(folder / 'hyperframes.json', {'paths': {'blocks':'compositions', 'components':'compositions/components', 'assets':'assets'}, 'media': {'autoProxy': True}})
    write_json(folder / 'meta.json', {'name':'mix-technos-v4', 'duration':15, 'width':1080, 'height':1920})
    return folder


def qa(pilot, run_dir, timings):
    image = pilot.docker_image()
    rel = run_dir.relative_to(LAB).as_posix()
    mount = ['docker','run','--rm','--cpus=1','--memory=2g','--user',f'{os.getuid()}:{os.getgid()}','-v',f'{LAB}:/lab']
    movie = f'/lab/{rel}/preview-aguarda-aprovacao.mp4'
    result = subprocess.run(mount + ['--entrypoint','ffprobe',image,'-v','error','-show_streams','-show_format','-of','json',movie], check=True, capture_output=True, text=True)
    probe = json.loads(result.stdout)
    video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    passed = (video['width'] == 1080 and video['height'] == 1920 and video['codec_name'] == 'h264'
              and video.get('pix_fmt') == 'yuv420p' and audio['codec_name'] == 'aac'
              and abs(float(probe['format']['duration']) - 15) < .2)
    write_json(run_dir / 'ffprobe.json', probe)
    if not passed:
        raise ValueError('O MP4 nao passou nos requisitos tecnicos; consulte ffprobe.json.')
    frames = run_dir / 'revisao'
    frames.mkdir(exist_ok=True)
    ffmpeg = mount + ['--entrypoint','ffmpeg',image,'-hide_banner','-loglevel','error','-y']
    subprocess.run(ffmpeg + ['-i',movie,'-vf','fps=1,scale=216:384,tile=5x3','-frames:v','1',f'/lab/{rel}/revisao/contato-15s.png'], check=True)
    moments = sorted(set([.3,1.,2.,14.3] + [round(x['inicio_s']+.1,3) for x in timings[1:]]))
    for moment in moments:
        subprocess.run(ffmpeg + ['-ss',str(moment),'-i',movie,'-frames:v','1',f'/lab/{rel}/revisao/frame-{moment:.3f}.png'], check=True)
    write_json(run_dir / 'quality-gate.json', {'technical_pass':True, 'visual_review':'PENDING',
        'factual_review':'PENDING', 'publication_approved':False, 'published':False,
        'checks_required':['Fotos pertencem ao mesmo modelo e variante','Produto inteiro e sem distorcao',
                           'Texto legivel, sem cortes e sem sobreposicao','Dora e legendas sincronizadas',
                           'Comparacao visual com a previa anterior','CTA e destino coerentes com o canal']})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--job', type=Path, default=DEFAULT_JOB)
    parser.add_argument('--render', action='store_true', help='Sintetiza Dora, renderiza e extrai frames para revisao.')
    args = parser.parse_args()
    if not args.render:
        parser.error('Use --render para produzir esta previa isolada.')
    lockfile = LAB / '.mix-technos-v4.lock'
    with lockfile.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Ja existe uma renderizacao V4 em andamento.')
        job = json.loads(args.job.read_text(encoding='utf-8'))
        entry, plan = plan_for_job(job)
        pilot = load_pilot()
        issues = pilot.validate_plan(plan, entry)
        if issues:
            raise ValueError('; '.join(issues))
        run_dir = LAB / 'agente-video-piloto/runs' / (time.strftime('%Y%m%d-%H%M%S') + '-technos-v4-' + uuid.uuid4().hex[:8])
        run_dir.mkdir(parents=True, exist_ok=False)
        print('[V4] Pasta nova:', run_dir, flush=True)
        write_json(run_dir / 'entrada.json', entry)
        write_json(run_dir / 'roteiro-ia.json', plan)
        write_json(run_dir / 'proveniencia-v4.json', {'job':str(args.job), 'job_sha256':hashlib.sha256(args.job.read_bytes()).hexdigest(),
            'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'pilot_sha256':hashlib.sha256((LAB/'agente-video-piloto/diretor_ia.py').read_bytes()).hexdigest(),
            'plan_author':'explicit_editorial_plan_not_Qwen', 'facts_source':'catalog_product_title_only',
            'voice':'pf_dora', 'speed':.85, 'layouts':LAYOUTS, 'publish':False})
        status = run_dir / 'STATUS.txt'
        status.write_text('PROCESSING\n', encoding='utf-8')
        try:
            durations = tts_with_logs(pilot, run_dir, plan)
            timings = pilot.timing(durations)
            # Complete the previous phrase before the next scene becomes visible.
            for a, b in zip(timings, timings[1:]):
                if b['inicio_s'] - .12 < a['fim_s']:
                    raise ValueError('As falas se sobrepoem a troca de cena.')
            write_json(run_dir / 'timing-real.json', timings)
            sources = pilot.obtain_images(entry, run_dir)
            folder = build_html(plan, timings, sources, run_dir)
            pilot.render_video(run_dir, folder)
            pilot.mix_audio(run_dir, timings)
            qa(pilot, run_dir, timings)
        except (Exception, KeyboardInterrupt) as error:
            status.write_text(f'FAILED\n{type(error).__name__}: {str(error)[:1000]}\nNada aprovado ou publicado.\n', encoding='utf-8')
            raise
        status.write_text('AWAITING_APPROVAL\nTecnico OK; revisao visual e factual pendentes. Nada publicado.\n', encoding='utf-8')
        print('[MP4]', run_dir / 'preview-aguarda-aprovacao.mp4', flush=True)
        print('[REVISAO]', run_dir / 'revisao/contato-15s.png', flush=True)
        print('[STATUS] AWAITING_APPROVAL. Nada publicado.', flush=True)


if __name__ == '__main__':
    def interrupted(signum, frame):
        raise RuntimeError(f'Execucao interrompida pelo sinal {signum}; verifique timeout ou encerramento externo.')

    signal.signal(signal.SIGTERM, interrupted)
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print('[ERRO]', str(error), file=sys.stderr)
        sys.exit(1)
