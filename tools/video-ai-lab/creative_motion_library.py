#!/usr/bin/env python3
"""Biblioteca criativa do Mix: planejamento seguro de movimentos.

Nao renderiza, nao chama Docker e nao publica. Python stdlib.
Os nomes dos efeitos sao instrucoes para o renderizador, nao efeitos ja implantados.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass

VOICE = {"motor": "kokoro-onnx", "id": "pf_dora", "idioma": "pt-br", "velocidade": 0.85}
MIN_TRANSITIONS = 3
EFFECTS = {
    "zoom_detalhe": "Aproximacao gradual sem extrapolar o quadro da imagem.",
    "pan_lateral": "Deslocamento suave dentro dos limites da foto.",
    "reveal": "Revelacao por mascara, sem deformar o produto.",
    "parallax_leve": "Profundidade simulada; nao inventar faces ocultas.",
    "corte_ritmico": "Mudanca de imagem real sincronizada ao roteiro.",
    "dissolve": "Mistura suave entre duas fotos reais do mesmo produto.",
    "slide": "Entrada lateral suave preservando proporcao.",
    "zoom_out": "Afastamento progressivo revelando composicao.",
}
TRANSITIONS = ("reveal", "dissolve", "slide", "corte_ritmico")
CAMERA_MOVES = ("zoom_detalhe", "pan_lateral", "parallax_leve", "zoom_out")


@dataclass(frozen=True)
class Motion:
    between_scenes: tuple[int, int]
    effect: str


def plan_movements(scene_count: int = 5, seed: int = 0) -> dict:
    """Plano deterministico; 5 cenas geram 4 transicoes, >=3 distintas."""
    if not isinstance(scene_count, int) or isinstance(scene_count, bool) or scene_count < 4:
        raise ValueError("Sao necessarias pelo menos 4 cenas para 3 transicoes.")
    if not isinstance(seed, int):
        raise ValueError("seed deve ser inteiro")
    transitions = [
        asdict(Motion((i, i + 1), TRANSITIONS[(i + seed) % len(TRANSITIONS)]))
        for i in range(scene_count - 1)
    ]
    moves = [CAMERA_MOVES[(i + seed) % len(CAMERA_MOVES)] for i in range(scene_count)]
    result = {
        "version": 1,
        "voice": dict(VOICE),
        "min_transitions": MIN_TRANSITIONS,
        "scene_moves": moves,
        "transitions": transitions,
        "human_approval_required": True,
        "published": False,
    }
    validate_plan(result)
    return result


def validate_plan(plan: dict) -> None:
    transitions = plan.get("transitions", [])
    if len(transitions) < MIN_TRANSITIONS:
        raise ValueError("Video com menos de 3 transicoes.")
    used = set()
    for index, transition in enumerate(transitions):
        if transition.get("between_scenes") != (index, index + 1):
            raise ValueError("Transicao fora da ordem das cenas.")
        effect = transition.get("effect")
        if effect not in TRANSITIONS:
            raise ValueError("Transicao desconhecida.")
        used.add(effect)
    if len(used) < MIN_TRANSITIONS:
        raise ValueError("Exigir 3 tipos distintos de transicao.")
    if plan.get("voice") != VOICE:
        raise ValueError("Voz deve ser Kokoro Dora 0.85 em pt-br.")
    if plan.get("human_approval_required") is not True or plan.get("published") is not False:
        raise ValueError("Publicacao automatica proibida.")


if __name__ == "__main__":
    print(json.dumps(plan_movements(), ensure_ascii=False, indent=2))
