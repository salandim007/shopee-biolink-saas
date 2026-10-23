#!/usr/bin/env python3
"""Mix de Produtos: cooperacao segura catalogo <-> producao de video.

Uso na VPS:
  python3 coordenador-ias-mix.py instalar
  python3 coordenador-ias-mix.py video
  python3 coordenador-ias-mix.py status

Nao publica; nao reinicia Docker; nao encerra o processamento atual.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LAB = Path.home() / 'hyperframes-lab'
PROJECT = Path('/opt/shopee-biolink-saas')
CONTAINER = 'shopee-biolink'
SOURCE = 'ai/run-nightly-post-texts.js'
DATA = PROJECT / 'data/ai/video-coordinator'
REQUEST = DATA / 'solicitacao.json'
ACK = DATA / 'pausa-confirmada.json'
STAMP = LAB / 'coordenador-ias-instalado.json'
DIRECTOR = LAB / 'agente-video-piloto/diretor_ia.py'
MODELO_CATALOGO = 'qwen3.5:4b'
MODELO_VIDEO = 'qwen3.5:4b'
ANCHOR = '        for (\n            const summary\n            of page.products\n        ) {\n'
MARK = 'MIX_PAUSA_COOPERATIVA_V1'

HELPER = r'''/* MIX_PAUSA_COOPERATIVA_V1: somente entre produtos, apos persistencia. */
const _mixFs = require('fs');
const _mixPath = require('path');
const _mixPauseDir = _mixPath.join(__dirname, '..', 'data', 'ai', 'video-coordinator');
async function _mixAguardarVezDoVideo() {
    const requestFile = _mixPath.join(_mixPauseDir, 'solicitacao.json');
    const ackFile = _mixPath.join(_mixPauseDir, 'pausa-confirmada.json');
    let announced = null;
    while (true) {
        let req;
        try {
            req = JSON.parse(_mixFs.readFileSync(requestFile, 'utf8'));
        } catch (e) {
            if (e.code !== 'ENOENT') console.warn('[MIX] Solicitacao invalida; liberando catalogo:', e.message);
            return;
        }
        if (!req || !/^[a-f0-9-]{36}$/.test(String(req.id || '')) ||
            !Number.isFinite(req.expira_ms) || Date.now() > req.expira_ms) {
            console.warn('[MIX] Pedido ausente/expirado; catalogo liberado.');
            return;
        }
        if (announced !== req.id) {
            _mixFs.mkdirSync(_mixPauseDir, {recursive:true});
            const tmp = ackFile + '.' + process.pid + '.tmp';
            _mixFs.writeFileSync(tmp, JSON.stringify({id:req.id, pid:process.pid, em:new Date().toISOString()}));
            _mixFs.renameSync(tmp, ackFile);
            console.log('[MIX] Catálogo pausado entre produtos. Pedido', req.id);
            announced = req.id;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

'''


def die(msg: str):
    raise RuntimeError(msg)


def run(argv, *, timeout=45, output=True, check=True):
    return subprocess.run(argv, check=check, timeout=timeout,
                          text=True, capture_output=not output)


def patch_js(source: str) -> str:
    if MARK in source:
        return source
    if source.count(ANCHOR) != 1 or source.count('async function processOne(summary) {') != 1:
        die('Codigo do catalogo nao bate com trecho confirmado. Nada alterado.')
    source = source.replace('async function processOne(summary) {',
                            HELPER + 'async function processOne(summary) {', 1)
    source = source.replace(ANCHOR, ANCHOR + '            await _mixAguardarVezDoVideo();\n', 1)
    return source


def atomic_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.new-' + uuid.uuid4().hex)
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp, path)


def install():
    LAB.mkdir(parents=True, exist_ok=True)
    stage = LAB / 'coordenador-ias-stage'
    stage.mkdir(parents=True, exist_ok=True)
    host = PROJECT / SOURCE
    if not host.is_file():
        die(f'Arquivo ausente: {host}')
    if not DIRECTOR.is_file():
        die(f'Diretor Criativo ausente: {DIRECTOR}')
    original_container = stage / 'runner-container-original.js'
    run(['docker', 'cp', f'{CONTAINER}:/app/{SOURCE}', str(original_container)])
    src_container = original_container.read_text(encoding='utf-8')
    src_host = host.read_text(encoding='utf-8')
    updated_container = patch_js(src_container)
    updated_host = patch_js(src_host)
    if MARK in src_container and MARK in src_host:
        print('[OK] O coordenador ja estava instalado em ambos os locais.')
        return
    prepared_container = stage / 'runner-container-preparado.js'
    prepared_host = stage / 'runner-host-preparado.js'
    prepared_container.write_text(updated_container, encoding='utf-8')
    prepared_host.write_text(updated_host, encoding='utf-8')
    # Syntax checks BEFORE changing either file.
    run(['node', '--check', str(prepared_container)])
    run(['node', '--check', str(prepared_host)])
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backups = LAB / 'backups'
    backups.mkdir(parents=True, exist_ok=True)
    shutil.copy2(original_container, backups / f'runner-container-{stamp}.js')
    shutil.copy2(host, backups / f'runner-host-{stamp}.js')
    # Deploy only after both copies/validators pass. The already-running Node keeps
    # its code in memory; only FUTURE runs load this change.
    if MARK not in src_host:
        shutil.copy2(prepared_host, host)
    if MARK not in src_container:
        run(['docker', 'cp', str(prepared_container), f'{CONTAINER}:/app/{SOURCE}'])
    # confirm both deployed in place, or refuse announcing success
    final_container = stage / 'runner-container-confirmar.js'
    run(['docker', 'cp', f'{CONTAINER}:/app/{SOURCE}', str(final_container)])
    if MARK not in host.read_text(encoding='utf-8') or MARK not in final_container.read_text(encoding='utf-8'):
        die('Falha na confirmacao: confira backups antes de prosseguir.')
    run(['docker', 'exec', CONTAINER, 'node', '--check', f'/app/{SOURCE}'])
    atomic_json(STAMP, {'instalado_em_epoch': time.time(), 'versao': MARK})
    DATA.mkdir(parents=True, exist_ok=True)
    print('[OK] Coordenador instalado no host e container; sintaxe confirmada.')
    print('[SEGURO] Processo ATUAL inalterado; nova pausa vale na PROXIMA execucao.')
    print('[BACKUP] ', backups)
    print('[INFO] Nada foi reiniciado, nada foi publicado.')


def proc_start(pid: int) -> float | None:
    try:
        stat = Path(f'/proc/{pid}/stat').read_text()
        tail = stat[stat.rindex(')') + 2:].split()
        start_ticks = int(tail[19])  # field 22, relative to field 3
        boot_epoch = time.time() - float(Path('/proc/uptime').read_text().split()[0])
        return boot_epoch + start_ticks / os.sysconf('SC_CLK_TCK')
    except (OSError, ValueError, IndexError):
        return None


def running_catalog() -> list[tuple[int, float | None]]:
    found = []
    for p in Path('/proc').iterdir():
        if not p.name.isdecimal():
            continue
        try:
            args = (p / 'cmdline').read_bytes().split(b'\0')
            values = [x.decode('utf-8', 'replace') for x in args if x]
        except OSError:
            continue
        if len(values) >= 2 and values[0].endswith(('node','/node')) and \
                any(v == '/app/ai/run-nightly-post-texts.js' for v in values[1:]):
            found.append((int(p.name), proc_start(int(p.name))))
    return found


def status():
    procs = running_catalog()
    print('[CATALOGO]', 'ativo ' + repr(procs) if procs else 'nao ha processo noturno ativo')
    print('[PATCH]', 'instalado' if STAMP.is_file() else 'nao instalado')
    print('[PAUSA]', 'solicitada' if REQUEST.exists() else 'nenhuma')
    print('[CONFIRMACAO]', 'presente' if ACK.exists() else 'nenhuma')
    try:
        print('[OLLAMA]', ', '.join(ollama_active()) or 'nenhum modelo carregado')
    except Exception as e:
        print('[OLLAMA] consulta indisponivel:', e)


def ollama_api(path: str):
    req = urllib.request.Request('http://127.0.0.1:11434' + path)
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.load(r)


def ollama_active() -> list[str]:
    return [str(m.get('name') or m.get('model') or '') for m in ollama_api('/api/ps').get('models', [])]


def run_job(argv: list[str], deadline_sec: int):
    proc = subprocess.Popen(argv, start_new_session=True)
    try:
        rc = proc.wait(timeout=deadline_sec)
        if rc != 0:
            die('Etapa falhou (codigo ' + str(rc) + '): ' + ' '.join(argv))
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
        die('Etapa excedeu o limite de seguranca e foi interrompida.')


def video():
    if not STAMP.exists():
        die('Instale antes: python3 coordenador-ias-mix.py instalar')
    # Protection against a legacy process that cannot acknowledge pause safely.
    install_epoch = float(json.loads(STAMP.read_text())['instalado_em_epoch'])
    procs = running_catalog()
    for pid, started in procs:
        if started is None or started < install_epoch:
            die(f'Catálogo ativo (PID {pid}) iniciou ANTES da instalação da pausa. '
                'Não será congelado nem encerrado. Aguarde a próxima execução; '
                'nada foi alterado.')
    if REQUEST.exists():
        try:
            req = json.loads(REQUEST.read_text(encoding='utf-8'))
            if float(req.get('expira_ms', 0)) > time.time() * 1000:
                die('Ja existe um pedido de video/pausa ativo; nao vou sobrepor.')
        except (json.JSONDecodeError, ValueError):
            pass
        REQUEST.unlink(missing_ok=True)
    runroot = LAB / 'agente-video-piloto/runs'
    if not DIRECTOR.is_file():
        die('Diretor Criativo nao localizado no laboratorio.')
    request_id = str(uuid.uuid4())
    expires = time.time() + 2100
    need_pause = bool(procs)
    try:
        if need_pause:
            ACK.unlink(missing_ok=True)
            atomic_json(REQUEST, {'id':request_id, 'expira_ms':round(expires*1000)})
            print('[PAUSA] Aguardando o catalogo concluir o produto atual...', flush=True)
            until = time.monotonic() + 180
            while time.monotonic() < until:
                if not running_catalog():
                    die('Rotina deixou de executar antes de confirmar a pausa.')
                try:
                    ack = json.loads(ACK.read_text(encoding='utf-8'))
                    if ack.get('id') == request_id:
                        print('[OK] Catalogo pausou ENTRE produtos; registros anteriores preservados.', flush=True)
                        break
                except (FileNotFoundError, json.JSONDecodeError):
                    pass
                time.sleep(1)
            else:
                die('Nao houve confirmacao de pausa em 180s. Catalogo liberado; video cancelado.')
        else:
            print('[INFO] Nenhum catalogo ativo. Nao e necessario pausar.', flush=True)
        # Preserve resources: unload only once the catalog has definitely yielded,
        # and only if it is still the loaded model. Ollama container is NOT restarted.
        active = ollama_active()
        if MODELO_CATALOGO in active and MODELO_VIDEO != MODELO_CATALOGO:
            print('[OLLAMA] Liberando o modelo 4B da RAM para o Diretor Criativo...', flush=True)
            run(['docker','exec','ollama','ollama','stop', MODELO_CATALOGO], timeout=30)
        available_kb = 0
        try:
            meminfo = Path('/proc/meminfo').read_text()
            available_kb = int(re.search(r'^MemAvailable:\s+(\d+)', meminfo, re.M).group(1))
        except (OSError, ValueError, AttributeError):
            pass
        if available_kb and available_kb < 1_250_000:
            die('Memoria livre insuficiente para gerar roteiro com seguranca.')
        existing = {x.name for x in runroot.iterdir() if x.is_dir()} if runroot.exists() else set()
        print(f'[IA] Gerando roteiro original com {MODELO_VIDEO}...', flush=True)
        run_job(['nice','-n','15','python3',str(DIRECTOR),'plano','--modelo',MODELO_VIDEO], 720)
        if not runroot.exists():
            die('A IA nao criou a pasta de roteiros.')
        created = [x for x in runroot.iterdir() if x.is_dir() and x.name not in existing and (x/'roteiro-ia.json').is_file()]
        if len(created) != 1:
            die('Nao foi possivel identificar inequivocamente um roteiro novo; video cancelado.')
        target = created[0]
        print('[ROTEIRO]', target/'roteiro-ia.json', flush=True)
        print('[VIDEO] Produzindo previa com Kokoro + HyperFrames...', flush=True)
        run_job(['nice','-n','15','python3',str(DIRECTOR),'produzir',str(target)], 900)
        preview = target / 'preview-aguarda-aprovacao.mp4'
        if not preview.is_file() or preview.stat().st_size < 100_000:
            die('Previa nao foi validada; nao existe arquivo MP4 adequado.')
        print('[SUCESSO] VIDEO PRONTO PARA APROVACAO:', preview, flush=True)
        print('[SEGURANCA] Nenhuma publicacao automatica.', flush=True)
    finally:
        # Release ONLY this request, and NEVER alter unrecognized requests.
        try:
            req = json.loads(REQUEST.read_text(encoding='utf-8'))
            if req.get('id') == request_id:
                REQUEST.unlink(missing_ok=True)
        except (FileNotFoundError, ValueError, json.JSONDecodeError):
            pass
        print('[RETOMADA] Pedido de pausa liberado; catalogo pode continuar.', flush=True)


def main():
    parser = argparse.ArgumentParser(description='Coordenador IA Mix de Produtos')
    parser.add_argument('acao', choices=['instalar','video','status'])
    args = parser.parse_args()
    if args.acao == 'instalar': install()
    elif args.acao == 'video': video()
    else: status()

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError, json.JSONDecodeError) as e:
        print('[ERRO]', str(e), file=sys.stderr, flush=True)
        sys.exit(1)
