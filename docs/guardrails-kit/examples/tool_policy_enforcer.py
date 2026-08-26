"""Exemplo de autorização determinística antes de executar tools.

O LLM nunca decide sozinho se está autorizado. A aplicação usa contexto
autenticado, policy e approval token validado no servidor.
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
from typing import Any, Literal


Risk = Literal["L0", "L1", "L2", "L3", "L4"]
Effect = Literal["read", "local_write", "external_write", "destructive"]


@dataclass(frozen=True)
class ToolSpec:
    name: str
    effect: Effect
    risk: Risk
    allowed_roles: frozenset[str]
    approval_required: bool
    max_calls_per_request: int


@dataclass(frozen=True)
class RequestContext:
    request_id: str
    user_id: str
    role: str
    tenant_id: str
    environment: str


@dataclass(frozen=True)
class Approval:
    token_id: str
    user_id: str
    tenant_id: str
    tool_name: str
    args_hash: str
    expires_at_epoch: int
    single_use: bool


TOOL_REGISTRY = {
    "search_knowledge": ToolSpec(
        name="search_knowledge",
        effect="read",
        risk="L1",
        allowed_roles=frozenset({"viewer", "analyst", "admin"}),
        approval_required=False,
        max_calls_per_request=4,
    ),
    "send_external_message": ToolSpec(
        name="send_external_message",
        effect="external_write",
        risk="L3",
        allowed_roles=frozenset({"authorized_sender", "admin"}),
        approval_required=True,
        max_calls_per_request=1,
    ),
}


def canonical_args_hash(arguments: dict[str, Any]) -> str:
    payload = json.dumps(
        arguments, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return sha256(payload).hexdigest()


def authorize_tool_call(
    *,
    tool_name: str,
    arguments: dict[str, Any],
    context: RequestContext,
    calls_so_far: int,
    approval: Approval | None,
    current_epoch: int,
) -> None:
    spec = TOOL_REGISTRY.get(tool_name)
    if spec is None:
        raise PermissionError("Tool não autorizada")

    if context.role not in spec.allowed_roles:
        raise PermissionError("Função sem permissão para a tool")

    if calls_so_far >= spec.max_calls_per_request:
        raise PermissionError("Limite de chamadas excedido")

    # O tenant deve vir do contexto autenticado, nunca do modelo.
    supplied_tenant = arguments.get("tenant_id")
    if supplied_tenant is not None and supplied_tenant != context.tenant_id:
        raise PermissionError("Tenant divergente")
    arguments["tenant_id"] = context.tenant_id

    if spec.effect in {"external_write", "destructive"}:
        if "idempotency_key" not in arguments:
            raise PermissionError("Idempotency key obrigatória")

    if spec.approval_required:
        if approval is None:
            raise PermissionError("Aprovação humana obrigatória")
        if approval.user_id != context.user_id:
            raise PermissionError("Aprovação vinculada a outro usuário")
        if approval.tenant_id != context.tenant_id:
            raise PermissionError("Aprovação vinculada a outro tenant")
        if approval.tool_name != tool_name:
            raise PermissionError("Aprovação vinculada a outra tool")
        if approval.expires_at_epoch < current_epoch:
            raise PermissionError("Aprovação expirada")
        if approval.args_hash != canonical_args_hash(arguments):
            raise PermissionError("Argumentos diferem dos aprovados")

    # Acrescente aqui validação JSON Schema, autorização por registro,
    # allowlist de destinos, PII, limites financeiros e policy-as-code.
