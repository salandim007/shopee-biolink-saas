#!/usr/bin/env python3
"""Piloto isolado Mix de Produtos: Ollama/Qwen -> plano -> Kokoro -> HyperFrames.

Somente laboratorio: nunca modifica SaaS, nunca publica, nunca reinicia containers.
Python 3.10+ stdlib. Dependencias TTS/HyperFrames instaladas separadamente na VPS.
"""
import argparse
import copy
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import wave
from pathlib import Path

from creative_motion_library import plan_movements

BASE = Path.home() / "hyperframes-lab"
HERE = Path(__file__).resolve().parent
ROLES = ["capa", "beneficio", "beneficio", "beneficio", "cta"]
STYLES = {"editorial", "vibrante", "premium", "natural", "tecnologico"}
MOVES = {"aproximar", "flutuar", "deslizar", "revelar", "parallax"}
SAFE_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
SAFE_ID = re.compile(r"^[0-9]{1,20}$")


def fail(message):
    raise RuntimeError(message)


def exec_cmd(args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)


def docker_image():
    r = exec_cmd(["docker", "inspect", "-f", "{{.Image}}", "shopee-biolink-hml"], capture_output=True)
    value = r.stdout.strip()
    if not value:
        fail("A imagem de homologacao shopee-biolink-hml nao foi localizada.")
    return value


def candidate_ollama_urls():
    custom = os.environ.get("OLLAMA_URL", "").strip()
    if custom:
        return [custom.rstrip("/")]
    candidates = ["http://127.0.0.1:11434"]
    try:
        d = exec_cmd(["docker", "inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", "ollama"], capture_output=True)
        for ip in d.stdout.split():
            if re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", ip):
                url = "http://" + ip + ":11434"
                if url not in candidates:
                    candidates.append(url)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return candidates


def api_json(base, path, obj=None, timeout=8):
    body = json.dumps(obj, ensure_ascii=False).encode() if obj is not None else None
    req = urllib.request.Request(base + path, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def connect_ollama(preferred="qwen3.5:4b"):
    errors = []
    for base in candidate_ollama_urls():
        try:
            response = api_json(base, "/api/tags", timeout=5)
            models = [m.get("name", "") for m in response.get("models", [])]
            model = preferred if preferred in models else None
            if not model:
                prefix = preferred.split(":")[0]
                model = next((name for name in models if name.startswith(prefix + ":")), None)
            if not model:
                fail(f"Qwen {preferred} nao foi encontrado. Modelos atuais: {', '.join(models) or '(nenhum)'}")
            return base, model
        except (OSError, ValueError, urllib.error.URLError) as e:
            errors.append(f"{base}: {e}")
    fail("Nao foi possivel consultar a API local do Ollama. " + " | ".join(errors))


def system_instructions():
    original = (HERE / "INSTRUCOES_AGENTE_VIDEO.md").read_text(encoding="utf-8")
    return """

AJUSTE OBRIGATORIO PARA ESTE PILOTO (o JSON a seguir substitui formato generico acima):
Devolva SOMENTE JSON valido, sem comentarios, sem markdown.
Campos de raiz: conceito_criativo (string), justificativa (string curta), estilo_visual (editorial|vibrante|premium|natural|tecnologico), paleta (objeto fundo, destaque, texto com hex #RRGGBB), cenas (array EXATAMENTE 5 cenas).
Cada cena precisa: papel (capa|beneficio|cta), fala_legenda (string pt-BR que sera falada IDENTICA no audio e escrita IDENTICA na tela), midia_referencia (imagem_1|imagem_2), evidencia_ids (lista de f0..f5), direcao_visual (string curta), movimento (aproximar|flutuar|deslizar|revelar|parallax).
A ordem das cenas: capa, beneficio, beneficio, beneficio, cta. Nao incluir tempo ou duracao: um programa medira WAV reais e criara a linha do tempo.
Maximo 9 palavras por fala; de preferencia 4 a 6. Maximo 36 palavras nas 5 falas somadas. Necessario voz suave 0.85 em 15s. Evite preposicoes e expressoes longas.
A capa deve apresentar nome do produto com personalidade; o CTA final deve incentivar conhecer/conferir, sem afirmar preco, promocao ou estoque.
Cada beneficio deve listar em evidencia_ids os indices fN que apoiam a alegacao. Capa e CTA podem ter evidencia_ids vazios.
NAO invente descontos, reviews, garantias, homologacoes, fatos nao fornecidos, seguranca garantida ou resultado clinico.
Variar estilo e imagem respeitando os atributos do produto, nao repetir mesmo visual em todo video.
"""


PLANO_JSON_SCHEMA_V3 = {'type': 'object', 'properties': {'conceito_criativo': {'type': 'string'}, 'justificativa': {'type': 'string'}, 'estilo_visual': {'type': 'string', 'enum': ['editorial', 'natural', 'premium', 'tecnologico', 'vibrante']}, 'paleta': {'type': 'object', 'properties': {'fundo': {'type': 'string', 'pattern': '^#[0-9A-Fa-f]{6}$'}, 'destaque': {'type': 'string', 'pattern': '^#[0-9A-Fa-f]{6}$'}, 'texto': {'type': 'string', 'pattern': '^#[0-9A-Fa-f]{6}$'}}, 'required': ['fundo', 'destaque', 'texto'], 'additionalProperties': False}, 'cenas': {'type': 'array', 'minItems': 5, 'maxItems': 5, 'items': {'type': 'object', 'properties': {'papel': {'type': 'string', 'enum': ['capa', 'beneficio', 'cta']}, 'fala_legenda': {'type': 'string', 'minLength': 9, 'maxLength': 85}, 'midia_referencia': {'type': 'string', 'enum': ['imagem_1', 'imagem_2']}, 'evidencia_ids': {'type': 'array', 'items': {'type': 'string', 'enum': ['f0', 'f1', 'f2', 'f3', 'f4', 'f5']}}, 'direcao_visual': {'type': 'string'}, 'movimento': {'type': 'string', 'enum': ['aproximar', 'flutuar', 'deslizar', 'revelar', 'parallax']}}, 'required': ['papel', 'fala_legenda', 'midia_referencia', 'evidencia_ids', 'direcao_visual', 'movimento'], 'additionalProperties': False}}}, 'required': ['conceito_criativo', 'justificativa', 'estilo_visual', 'paleta', 'cenas'], 'additionalProperties': False}


def model_generate(base, model, prompt, temperature=0.6):
    payload = {"model": model, "stream": False, "format": PLANO_JSON_SCHEMA_V3, "think": False,
               "messages": [{"role": "system", "content": system_instructions()},
                            {"role": "user", "content": prompt}],
               "options": {"temperature": temperature, "num_predict": 1700}, "keep_alive": "5m"}
    result = api_json(base, "/api/chat", payload, timeout=480)
    msg = result.get("message") or {}
    content = msg.get("content", "").strip()
    if not content:
        fail("O modelo respondeu sem conteudo. " + str(result.get("done_reason", "")))
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        fail(f"Resposta da IA nao e JSON valido: {e}; inicio={content[:200]!r}")


def validate_plan(data, entry):
    issues = []
    if not isinstance(data, dict):
        return ["A saida nao e objeto JSON."]
    if not isinstance(data.get("conceito_criativo"), str) or len(data["conceito_criativo"]) < 5:
        issues.append("conceito_criativo ausente/curto")
    if not isinstance(data.get("justificativa"), str):
        issues.append("justificativa ausente")
    if not isinstance(data.get("estilo_visual"), str) or data.get("estilo_visual") not in STYLES:
        issues.append("estilo_visual deve estar em: " + ", ".join(sorted(STYLES)))
    pal = data.get("paleta")
    if not isinstance(pal, dict) or any(not SAFE_HEX.fullmatch(str(pal.get(k, ""))) for k in ("fundo", "destaque", "texto")):
        issues.append("paleta deve conter hex #RRGGBB de fundo/destaque/texto")
    scenes = data.get("cenas")
    if not isinstance(scenes, list) or len(scenes) != 5:
        return issues + ["cenas deve conter exatamente 5 itens (capa, 3 beneficios, cta)"]
    total_words = 0
    count_facts = len(entry["produto"]["fatos_confirmados"])
    refs = {i["id"] for i in entry["produto"]["imagens"]}
    for i, c in enumerate(scenes):
        if not isinstance(c, dict):
            issues.append(f"cena {i}: nao e objeto")
            continue
        if c.get("papel") != ROLES[i]:
            issues.append(f"cena {i}: papel precisa ser {ROLES[i]}")
        frase = c.get("fala_legenda", "")
        if not isinstance(frase, str) or len(frase) < 9 or len(frase) > 85:
            issues.append(f"cena {i}: fala_legenda deve ter 9-85 caracteres")
            continue
        wc = len(frase.split())
        total_words += wc
        if wc > 9:
            issues.append(f"cena {i}: {wc} palavras, maximo 9")
        if re.search(r"\b(?:R\$|reais|%|gr[aá]tis|desconto|promo[cç][aã]o|estoque|garantid[oa]|certificad[oa])\b", frase, re.I):
            issues.append(f"cena {i}: frase contem dado comercial nao comprovado")
        if not isinstance(c.get("midia_referencia"), str) or c.get("midia_referencia") not in refs:
            issues.append(f"cena {i}: midia_referencia invalida")
        if not isinstance(c.get("movimento"), str) or c.get("movimento") not in MOVES:
            issues.append(f"cena {i}: movimento invalido")
        ev = c.get("evidencia_ids")
        if not isinstance(ev, list) or any(not isinstance(x, str) or not re.fullmatch(r"f\d+", x) or int(x[1:]) >= count_facts for x in ev):
            issues.append(f"cena {i}: evidencia_ids invalidos")
        if i in (1, 2, 3) and isinstance(ev, list) and not ev:
            issues.append(f"cena {i}: beneficio sem evidencia")
        if not isinstance(c.get("direcao_visual"), str):
            issues.append(f"cena {i}: direcao_visual ausente")
    if total_words > 36:
        issues.append(f"total de {total_words} palavras excede 36")
    return issues


def plan(entry_path, model_pref):
    entry = json.loads(entry_path.read_text(encoding="utf-8"))
    item_id = str(entry["produto"]["item_id"])
    if not SAFE_ID.fullmatch(item_id):
        fail("Item ID invalido")
    base, model = connect_ollama(model_pref)
    print(f"[OK] Conexao Ollama em {base}; modelo ja instalado: {model}", flush=True)
    indexed = copy.deepcopy(entry)
    indexed["produto"]["fatos_confirmados"] = [dict(id=f"f{i}", texto=fact) for i, fact in enumerate(entry["produto"]["fatos_confirmados"])]
    prompt = "CRIE AGORA UM PLANO ORIGINAL DE VIDEO DE 15s, SOMENTE JSON. DADOS VERIFICADOS:\n" + json.dumps(indexed, ensure_ascii=False)
    print("[IA] Qwen preparando roteiro original (sem renderizar e sem publicar)...", flush=True)
    result = None
    for attempt in range(2):
        result = model_generate(base, model, prompt, temperature=0.55 if attempt else 0.68)
        issues = validate_plan(result, entry)
        if not issues:
            break
        print("[VALIDADOR] Necessita revisao automatica: " + "; ".join(issues), flush=True)
        prompt = ("REESCREVA UM NOVO JSON COMPLETO, corrija TODOS os problemas sem inventar fatos. "
                  + "Problemas: " + " | ".join(issues) + "\nDados autorizados: " + json.dumps(indexed, ensure_ascii=False)
                  + "\nJSON anterior: " + json.dumps(result, ensure_ascii=False))
    if issues:
        fail("A IA nao passou na validacao estrutural em duas tentativas; nao vamos renderizar texto inseguro. " + "; ".join(issues))
    run_root = BASE / "agente-video-piloto" / "runs"
    run_root.mkdir(parents=True, exist_ok=True)
    run_dir = run_root / (time.strftime("%Y%m%d-%H%M%S") + "-" + item_id)
    run_dir.mkdir(parents=True, exist_ok=False)
    (run_dir / "entrada.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    (run_dir / "roteiro-ia.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    (run_dir / "STATUS.txt").write_text("ROTEIRO_IA_GERADO_A_VERIFICAR\nSem publicacao. A verificacao factual semantica exige revisao humana.\n", encoding="utf-8")
    print("[OK] Roteiro IA salvo em " + str(run_dir / "roteiro-ia.json"))
    print("[INFO] Conceito criativo: " + result["conceito_criativo"])
    for idx, c in enumerate(result["cenas"]):
        print(f"  {idx+1}. [{c['papel']}] {c['fala_legenda']}")
    print("[PROXIMO] Para produzir a previa, rode: python3 diretor_ia.py produzir " + str(run_dir))
    return run_dir


def wav_duration(path):
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


def tts(run_dir, script):
    tts_exe = BASE / "node_modules/.bin/hyperframes"
    venv_py = BASE / "tts-venv/bin/python"
    if not tts_exe.exists() or not venv_py.exists():
        fail("HyperFrames e/ou tts-venv nao foram encontrados no laboratorio da VPS")
    clips = run_dir / "falas"
    clips.mkdir(exist_ok=True)
    durations = []
    for i, scene in enumerate(script["cenas"]):
        wav = clips / f"cap{i}.wav"
        if not wav.exists():
            print(f"[TTS] Cena {i+1}/5: {scene['fala_legenda']}", flush=True)
            env = dict(os.environ, HYPERFRAMES_PYTHON=str(venv_py))
            exec_cmd(["nice", "-n", "15", str(tts_exe), "tts", scene["fala_legenda"],
                      "--voice", "pf_dora", "--lang", "pt-br", "--speed", "0.85",
                      "--output", str(wav)], env=env)
        durations.append(wav_duration(wav))
    return durations


def timing(durations):
    duration_total = 15.0
    voice_gap = 0.24
    # Garante capa no inicio e CTA ate fim; nao altera pitch nem velocidade do TTS.
    required = 0.25 + sum(durations) + voice_gap * 4 + 0.55
    if required > duration_total:
        fail(f"Falhas de 15 segundos: narracoes somam {sum(durations):.2f}s + folga. "
             "Roteiro deve ser encurtado pela IA, nunca acelerar voz ou cortar audio.")
    free = duration_total - required
    allocations = [d + voice_gap + free / 5 for d in durations]
    starts = [0.16]
    for i in range(1, 5):
        starts.append(starts[-1] + allocations[i-1])
    return [{"inicio_s": round(start, 3), "fala_s": round(d, 3), "fim_s": round(start + d, 3)}
            for start, d in zip(starts, durations)]


def obtain_images(entry, run_dir):
    destination = run_dir / "composicao" / "assets"
    destination.mkdir(parents=True, exist_ok=True)
    product_id = str(entry["produto"]["item_id"])
    original = BASE / "peitoral-elitegear-v1"
    copy_paths = []
    if product_id == "23693566603" and original.exists():
        # Fotos desta MESMA SKU, extraidas da composicao piloto aprovada (sem baixar nada).
        for filename in ["arte-aprovada.jpg", "detalhe-produto.jpg"]:
            p = original / "assets" / filename
            if p.is_file():
                copy_paths.append(p)
    srcs = {}
    for i, image in enumerate(entry["produto"]["imagens"]):
        source_id = image["id"]
        if i < len(copy_paths):
            img_target = destination / f"produto{i}.jpg"
            shutil.copyfile(copy_paths[i], img_target)
        else:
            url = image["url"]
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme != "https" or parsed.hostname not in ("cf.shopee.com.br",):
                fail("URL de imagem nao e origem Shopee autorizada: " + url)
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as response:
                payload = response.read(10_000_001)
            if len(payload) > 10_000_000 or not (payload.startswith(b"\xff\xd8") or payload.startswith(b"\x89PNG") or payload.startswith(b"RIFF")):
                fail("Imagem remota invalida ou maior que 10MB")
            ext = ".png" if payload.startswith(b"\x89PNG") else (".webp" if payload.startswith(b"RIFF") else ".jpg")
            img_target = destination / f"produto{i}{ext}"
            img_target.write_bytes(payload)
        srcs[source_id] = "assets/" + img_target.name
    return srcs


def build_html(plan_data, timings, srcs, run_dir):
    pal = plan_data["paleta"]
    theme = plan_data["estilo_visual"]
    color_a, color_b, color_t = (pal[key] for key in ("fundo", "destaque", "texto"))
    key_font = "Georgia,serif" if theme in ("premium", "editorial", "natural") else "Arial,sans-serif"
    style_props = {
        "editorial": ("300px", "1010px", "62px", "2px solid " + color_b, "rgba(10,18,25,.90)"),
        "vibrante": ("265px", "1100px", "67px", "5px solid " + color_b, "rgba(18,18,18,.93)"),
        "premium": ("320px", "980px", "58px", "2px solid " + color_b, "rgba(6,9,12,.93)"),
        "natural": ("345px", "935px", "60px", "2px solid " + color_b, "rgba(30,37,28,.92)"),
        "tecnologico": ("285px", "1040px", "63px", "4px solid " + color_b, "rgba(7,15,26,.93)"),
    }[theme]
    composition_id = "mix-diretor-ia-piloto"
    motion_plan = plan_movements(len(plan_data["cenas"]), seed=sum(map(ord, plan_data["conceito_criativo"])) % 4)
    blocks = []
    js = []
    for i, scene in enumerate(plan_data["cenas"]):
        frase = html.escape(scene["fala_legenda"], quote=True)
        src = html.escape(srcs[scene["midia_referencia"]], quote=True)
        role = scene["papel"]
        subtitle_class = "capa" if role == "capa" else ("cta" if role == "cta" else "beneficio")
        blocks.append(f'''<section id="scene{i}" class="scene {subtitle_class}">
          <div class="halo"></div><img class="product" src="{src}" alt="Foto real do produto" />
          <div class="captions" id="caption{i}"><div class="eyebrow">{"CONHEÇA" if role == "capa" else ("CONFIRA" if role == "cta" else "DETALHES QUE IMPORTAM")}</div>
          <div class="caption">{frase}</div></div>
          </section>''')
        start = timings[i]["inicio_s"]
        speech_end = timings[i]["fim_s"]
        # Aparecimento da legenda ligeiramente ANTES da voz; desaparece APOS o fim da voz.
        visible_from = max(0, start - 0.10)
        visible_until = min(14.9, max(speech_end + 0.25, timings[i+1]["inicio_s"] - 0.09 if i < 4 else 14.85))
        movement = motion_plan["scene_moves"][i]
        # Movimentos mais perceptiveis. Escala uniforme, produto sempre preservado.
        movement_values = {
            "zoom_detalhe": (-28, -14, 1.26, 1.08),
            "pan_lateral": (-95, 0, 1.15, 1.15),
            "parallax_leve": (-72, 38, 1.20, 1.08),
            "zoom_out": (0, 0, 1.25, 1.02),
        }
        x_initial, y_initial, zoom_start, zoom_end = movement_values[movement]
        transition = "dissolve" if i == 0 else motion_plan["transitions"][i-1]["effect"]
        # Efeitos claramente distintos. Corte, slide, mascara e dissolve.
        transitions = {
            "reveal": ("autoAlpha:1,clipPath:'inset(0 100% 0 0)'",
                       "autoAlpha:1,clipPath:'inset(0 0% 0 0)',x:0", 0.38),
            "dissolve": ("autoAlpha:0,x:0", "autoAlpha:1,x:0", 0.40),
            "slide": ("autoAlpha:1,x:420", "autoAlpha:1,x:0", 0.32),
            "corte_ritmico": ("autoAlpha:0,x:0", "autoAlpha:1,x:0", 0.03),
        }
        enter_from, enter_to, enter_time = transitions[transition]
        # Nunca obscurecer a legenda enquanto a respectiva narracao esta em andamento.
        js += [
            f" t.set('#scene{i}',{{autoAlpha:0,x:0,clipPath:'inset(0 0% 0 0)'}},0);",
            f" t.fromTo('#scene{i}',{{{enter_from}}},{{{enter_to},duration:{enter_time:.2f},immediateRender:false}}, {visible_from:.3f});",
            f" t.fromTo('#scene{i} .captions',{{autoAlpha:0,y:28}},{{autoAlpha:1,y:0,duration:0.23,immediateRender:false}}, {visible_from:.3f});",
            f" t.fromTo('#scene{i} .product',{{x:{x_initial},y:{y_initial},scale:{zoom_start}}},{{x:0,y:0,scale:{zoom_end},duration:{max(0.8,visible_until-visible_from):.3f},ease:'power1.out',immediateRender:false}}, {visible_from:.3f});",
            f" t.to('#scene{i}',{{autoAlpha:0,duration:0.14}}, {visible_until:.3f});",
        ]
    template = '''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Mix de Produtos - Produzido pela IA</title>
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0;overflow:hidden;background:#141414}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;color:__TEXT__;font-family:__FONT__;
background:linear-gradient(145deg,__FUNDO__,#111922 76%,__FUNDO__)}
#grain{position:absolute;inset:0;opacity:.33;background:radial-gradient(circle at 18% 19%,__DESTAQUE__ 0%,transparent 30%),radial-gradient(circle at 90% 75%,__DESTAQUE__ 0%,transparent 22%)}
.brand{position:absolute;z-index:100;top:98px;left:70px;right:70px;color:#f7f7f7;text-align:center;letter-spacing:9px;font:600 28px Arial,sans-serif;opacity:.9;text-shadow:0 2px 16px #000}
.scene{position:absolute;inset:0;overflow:hidden}
.halo{position:absolute;inset:195px 40px 400px;border-radius:46%;background:radial-gradient(circle,__DESTAQUE__44,transparent 66%);filter:blur(45px)}
.product{position:absolute;top:__IMG_TOP__;left:70px;width:940px;height:__IMG_HEIGHT__;object-fit:contain;filter:drop-shadow(0 30px 48px rgba(0,0,0,.35));}
.captions{position:absolute;top:1375px;left:74px;right:74px;min-height:215px;max-height:285px;padding:36px 38px 44px;border-radius:32px;
background:__CAP_BG__;border:__BORDER__;text-align:center;box-shadow:0 20px 70px rgba(0,0,0,.4);color:#fff}
.eyebrow{font:600 23px Arial,sans-serif;letter-spacing:5px;color:__DESTAQUE__;margin-bottom:15px}
.caption{font:700 __FONT_SIZE__/1.16 __FONT__;overflow-wrap:break-word}
.scene.capa .caption{font-size:70px}
.scene.cta .caption{font-size:65px}
.footer{position:absolute;bottom:205px;left:85px;right:85px;color:#fff;text-align:center;letter-spacing:3px;font:600 25px Arial,sans-serif;opacity:.7}
</style></head><body>
<div id="root" data-composition-id="__ID__" data-start="0" data-duration="15" data-width="1080" data-height="1920">
<div id="grain"></div><div class="brand">✦ MIX DE PRODUTOS ✦</div>
__SCENES__
<div class="footer">SELEÇÃO ESPECIAL • MIX DE PRODUTOS</div></div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>if(typeof gsap!=='undefined'){
const t=gsap.timeline({paused:true,defaults:{ease:'power2.inOut'}});
__TIMELINE__
t.to({}, {duration:.1},14.9);
window.__timelines=window.__timelines||{};window.__timelines['__ID__']=t;
}</script></body></html>'''
    for tag, value in {"__TEXT__": color_t, "__FUNDO__": color_a, "__DESTAQUE__": color_b, "__FONT__": key_font,
                       "__IMG_TOP__": style_props[0], "__IMG_HEIGHT__": style_props[1], "__FONT_SIZE__": style_props[2], "__BORDER__": style_props[3], "__CAP_BG__": style_props[4],
                       "__ID__": composition_id, "__SCENES__": "\n".join(blocks), "__TIMELINE__": "\n".join(js)}.items():
        template = template.replace(tag, value)
    comp_dir = run_dir / "composicao"
    comp_dir.mkdir(parents=True, exist_ok=True)
    (comp_dir / "index.html").write_text(template, encoding="utf-8")
    (comp_dir / "hyperframes.json").write_text(json.dumps({"paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
                                                         "media": {"autoProxy": True}}, indent=2), encoding="utf-8")
    (comp_dir / "meta.json").write_text(json.dumps({"name": composition_id, "duration": 15, "width": 1080, "height": 1920}, indent=2), encoding="utf-8")
    return comp_dir


def render_video(run_dir, comp_dir):
    img = docker_image()
    rel = comp_dir.relative_to(BASE)
    out = (run_dir / "video-sem-audio.mp4").relative_to(BASE)
    cmd = ["docker", "run", "--rm", "--cpus=1", "--memory=2g", "--shm-size=512m",
           "-v", f"{BASE}:/lab", "--entrypoint", "sh", img,
           "-lc", f"cd /lab/{rel} && node /lab/node_modules/hyperframes/bin/hyperframes.mjs render --quality draft --workers 1 --low-memory-mode --output /lab/{out}"]
    print("[HYPERFRAMES] Render isolado no Docker homologacao (pode demorar)...", flush=True)
    exec_cmd(cmd)


def mix_audio(run_dir, timings):
    img = docker_image()
    rel = run_dir.relative_to(BASE)
    args = ["docker", "run", "--rm", "--cpus=1", "--memory=2g", "-v", f"{BASE}:/lab", "--entrypoint", "ffmpeg", img,
            "-hide_banner", "-loglevel", "error", "-y", "-i", f"/lab/{rel}/video-sem-audio.mp4"]
    for i in range(5):
        args += ["-i", f"/lab/{rel}/falas/cap{i}.wav"]
    filters = []
    for i, t in enumerate(timings):
        delay = round(t["inicio_s"] * 1000)
        filters.append(f"[{i+1}:a]adelay={delay}:all=1[a{i}]")
    filters.append("".join(f"[a{i}]" for i in range(5)) + "amix=inputs=5:duration=longest:normalize=0,apad[aout]")
    args += ["-filter_complex", ";".join(filters), "-map", "0:v:0", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-t", "15", "-movflags", "+faststart", f"/lab/{rel}/preview-aguarda-aprovacao.mp4"]
    print("[FFMPEG] Sincronizando fala e legenda nos mesmos tempos...", flush=True)
    exec_cmd(args)
    return run_dir / "preview-aguarda-aprovacao.mp4"


def produce(run_dir):
    run_dir = run_dir.resolve()
    if not run_dir.is_relative_to((BASE / "agente-video-piloto" / "runs").resolve()):
        fail("A pasta do piloto deve estar dentro de /home/admin/hyperframes-lab/agente-video-piloto/runs")
    plan_path = run_dir / "roteiro-ia.json"
    if not plan_path.exists():
        fail("Roteiro da IA ainda nao existe. Execute primeiro: plano")
    plan_data = json.loads(plan_path.read_text(encoding="utf-8"))
    entry = json.loads((run_dir / "entrada.json").read_text(encoding="utf-8"))
    issues = validate_plan(plan_data, entry)
    if issues:
        fail("Roteiro invalido: " + "; ".join(issues))
    durations = tts(run_dir, plan_data)
    placements = timing(durations)
    (run_dir / "timing-real.json").write_text(json.dumps(placements, ensure_ascii=False, indent=2), encoding="utf-8")
    for idx, sec in enumerate(placements):
        print(f"[SYNC] Legenda {idx+1}: {sec['inicio_s']:.2f}s, audio {sec['fala_s']:.2f}s, termina {sec['fim_s']:.2f}s")
    srcs = obtain_images(entry, run_dir)
    comp = build_html(plan_data, placements, srcs, run_dir)
    render_video(run_dir, comp)
    file = mix_audio(run_dir, placements)
    (run_dir / "STATUS.txt").write_text("PREVIA_GERADA_AGUARDA_APROVACAO\nNUNCA publicar automaticamente. Conferencia factual humana obrigatoria.\n", encoding="utf-8")
    print("\n[OK] PREVIA PRONTA PARA REVISAO: " + str(file))
    print("[SEGURANCA] Nada publicado; nenhum container alterado ou reiniciado.")


def main():
    parser = argparse.ArgumentParser(description="Mix de Produtos: Diretor Criativo IA (piloto isolado)")
    sub = parser.add_subparsers(dest="command", required=True)
    ping = sub.add_parser("conexao", help="Verifica Qwen no Ollama, sem gerar nada")
    ping.add_argument("--modelo", default="qwen3.5:4b")
    p = sub.add_parser("plano", help="Pede ao Qwen o roteiro JSON criativo")
    p.add_argument("--entrada", type=Path, default=HERE / "ENTRADA_TESTE_PEITORAL.json")
    p.add_argument("--modelo", default="qwen3.5:4b")
    v = sub.add_parser("produzir", help="Sintetiza/mede/renderiza preview, sem publicar")
    v.add_argument("pasta_roteiro", type=Path)
    args = parser.parse_args()
    if args.command == "conexao":
        base, model = connect_ollama(args.modelo)
        print(f"CONECTADO: Ollama em {base}, modelo local {model} (nenhum download)")
    elif args.command == "plano":
        plan(args.entrada, args.modelo)
    elif args.command == "produzir":
        produce(args.pasta_roteiro)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, urllib.error.URLError, OSError, ValueError, KeyError) as e:
        print("[ERRO] " + str(e), file=sys.stderr)
        sys.exit(1)
