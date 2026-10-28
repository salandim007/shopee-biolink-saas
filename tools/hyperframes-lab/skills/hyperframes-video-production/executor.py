#!/usr/bin/env python3
"""Executor da Skill HyperFrames — Mix de Produtos."""

import json
import re
import sys
from pathlib import Path

LAB = Path("/home/admin/hyperframes-lab")
JOBS = Path(
    "/opt/shopee-biolink-homologacao/data/"
    "creative-studio/jobs"
)

PROJECT = LAB / "mix-produto-vertical-v1"

def load_job(job_id):
    if not re.fullmatch(r"[a-f0-9-]{36}", job_id):
        raise ValueError("Identificador de trabalho inválido.")

    job_dir = JOBS / job_id
    job_path = job_dir / "job.json"

    job = json.loads(job_path.read_text(encoding="utf-8"))

    if job.get("id") != job_id:
        raise ValueError("Identificador inconsistente.")

    if job.get("template") != "mix-impacto-v1":
        raise ValueError("Template não autorizado.")

    if job.get("status") != "PENDING":
        raise ValueError("Trabalho não está pendente.")

    images = job.get("images")

    if not isinstance(images, list) or not 1 <= len(images) <= 5:
        raise ValueError("Quantidade inválida de fotografias.")

    if len(set(images)) != len(images):
        raise ValueError("Fotografias duplicadas.")

    return job_dir, job


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: executor.py JOB_ID")

    job_dir, job = load_job(sys.argv[1])

    print("=== SKILL HYPERFRAMES ===")
    print("Trabalho:", job["id"])
    print("Produto:", job["product"]["title"])
    print("Fotografias:", len(job["images"]))
    print("Template:", job["template"])
    print("Projeto:", PROJECT)
    print("Diretório do trabalho:", job_dir)
    print("Validação inicial OK.")
    print("Renderização ainda não iniciada.")


if __name__ == "__main__":
    main()
