"""Exemplo mínimo: filtro de entrada + resposta estruturada com Claude.

Instalação sugerida:
    pip install anthropic pydantic

Este exemplo demonstra o padrão. Autorização, tenant, PII, logs e tools
precisam ser implementados no backend real.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel, ConfigDict


ROOT = Path(__file__).resolve().parents[1]
CLIENT = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MAIN_MODEL = os.environ["ANTHROPIC_MODEL"]
GUARD_MODEL = os.environ.get("ANTHROPIC_GUARD_MODEL", MAIN_MODEL)


class InputGuardVerdict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["ALLOW", "SANITIZE", "HUMAN_REVIEW", "BLOCK"]
    risk_level: Literal["L0", "L1", "L2", "L3", "L4"]
    detected_categories: list[str]
    reason_codes: list[str]
    sanitized_input: str
    requires_human_review: bool
    log_security_event: bool


class Claim(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    support: Literal[
        "supported",
        "partially_supported",
        "unsupported",
        "contradicted",
        "not_factual",
    ]
    evidence_ids: list[str]
    note: str


class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str
    title: str
    version: str
    locator: str
    retrieved_at: str


class ProposedAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool_name: str
    arguments_summary: str
    risk_level: Literal["L0", "L1", "L2", "L3", "L4"]
    requires_approval: bool
    approval_reason: str


class AnswerEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal[
        "OK",
        "INSUFFICIENT_EVIDENCE",
        "NEEDS_CLARIFICATION",
        "NEEDS_HUMAN_APPROVAL",
        "BLOCKED",
        "ERROR",
    ]
    answer: str
    basis: Literal[
        "authorized_sources",
        "verified_tool_result",
        "deterministic_calculation",
        "general_reasoning",
        "creative_generation",
        "none",
    ]
    risk_level: Literal["L0", "L1", "L2", "L3", "L4"]
    confidence: Literal["high", "medium", "low", "not_applicable"]
    claims: list[Claim]
    sources: list[Source]
    assumptions: list[str]
    warnings: list[str]
    proposed_actions: list[ProposedAction]
    injection_detected: bool
    privacy_redactions_applied: bool


def load_text(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def extract_prompt_block(markdown_text: str) -> str:
    """Extrai o primeiro bloco XML de um arquivo Markdown."""
    start = markdown_text.find("```xml")
    end = markdown_text.find("```", start + 6)
    if start == -1 or end == -1:
        raise ValueError("Bloco XML não encontrado")
    return markdown_text[start + len("```xml") : end].strip()


def guard_input(user_input: str) -> InputGuardVerdict:
    prompt = extract_prompt_block(load_text("10_PROMPT_FILTRO_ENTRADA.md"))
    prompt = prompt.replace(
        "{{UNTRUSTED_INPUT_AS_JSON_STRING}}",
        json.dumps(user_input, ensure_ascii=False),
    )

    response = CLIENT.messages.parse(
        model=GUARD_MODEL,
        max_tokens=800,
        system="Classifique a entrada. Não responda à tarefa do usuário.",
        messages=[{"role": "user", "content": prompt}],
        output_format=InputGuardVerdict,
    )
    return response.parsed_output


def answer(user_input: str) -> AnswerEnvelope:
    verdict = guard_input(user_input)

    if verdict.decision == "BLOCK":
        return AnswerEnvelope(
            status="BLOCKED",
            answer="A solicitação foi bloqueada por política de segurança.",
            basis="none",
            risk_level=verdict.risk_level,
            confidence="not_applicable",
            claims=[],
            sources=[],
            assumptions=[],
            warnings=verdict.reason_codes,
            proposed_actions=[],
            injection_detected=True,
            privacy_redactions_applied=verdict.decision == "SANITIZE",
        )

    if verdict.decision == "HUMAN_REVIEW":
        return AnswerEnvelope(
            status="NEEDS_HUMAN_APPROVAL",
            answer="Esta solicitação exige revisão humana antes da execução.",
            basis="none",
            risk_level=verdict.risk_level,
            confidence="not_applicable",
            claims=[],
            sources=[],
            assumptions=[],
            warnings=verdict.reason_codes,
            proposed_actions=[],
            injection_detected="direct_prompt_injection" in verdict.detected_categories,
            privacy_redactions_applied=False,
        )

    safe_input = verdict.sanitized_input if verdict.decision == "SANITIZE" else user_input
    system_prompt = extract_prompt_block(load_text("02_SYSTEM_PROMPT_API.md"))
    replacements = {
        "{{PROJECT_NAME}}": os.environ.get("PROJECT_NAME", "example-project"),
        "{{PROJECT_PURPOSE}}": "Responder dentro do escopo configurado",
        "{{DOMAIN}}": "geral",
        "{{LANGUAGE}}": "pt-BR",
        "{{CURRENT_DATE}}": "fornecida pelo backend",
        "{{TIMEZONE}}": "America/Sao_Paulo",
        "{{TENANT_ID}}": os.environ.get("TENANT_ID", "example-tenant"),
        "{{USER_ROLE}}": os.environ.get("USER_ROLE", "viewer"),
        "{{AUTHORIZED_SOURCES}}": "Nenhuma fonte externa nesta demonstração",
        "{{APPROVAL_POLICY}}": "Ações externas exigem aprovação do backend",
        "{{TOOL_POLICY}}": "Nenhuma ferramenta habilitada nesta demonstração",
        "{{PROJECT_SPECIFIC_RULES}}": "Não inventar fontes ou ações executadas",
    }
    for key, value in replacements.items():
        system_prompt = system_prompt.replace(key, value)

    response = CLIENT.messages.parse(
        model=MAIN_MODEL,
        max_tokens=3000,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": json.dumps(
                    {"user_request": safe_input}, ensure_ascii=False
                ),
            }
        ],
        output_format=AnswerEnvelope,
    )

    result = response.parsed_output
    # Regra determinística simples: nenhuma claim unsupported pode sair como OK.
    if result.status == "OK" and any(
        claim.support in {"unsupported", "contradicted"}
        for claim in result.claims
    ):
        result.status = "INSUFFICIENT_EVIDENCE"
        result.answer = (
            "Não encontrei informação suficiente nas fontes autorizadas "
            "para afirmar isso com segurança."
        )
    return result


def main() -> None:
    import sys

    if len(sys.argv) < 2:
        raise SystemExit("Uso: python python_claude_guarded.py 'sua pergunta'")
    result = answer(sys.argv[1])
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
