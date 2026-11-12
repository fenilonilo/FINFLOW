"""Classificação de compras de fatura via LLM local (llama-server, API OpenAI).

Uma chamada por importação; saída restrita por json_schema ao enum de categorias.
Qualquer falha (desligado, rede, timeout, JSON ruim) -> Nones; nunca levanta.
"""

import json
import logging
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Você classifica compras de fatura de cartão de crédito brasileiro. "
    "Para cada descrição da lista numerada, escolha exatamente uma das categorias "
    "dadas. Responda apenas o array JSON com as categorias, na mesma ordem. "
    "Use 'Outros' quando nenhuma se aplicar claramente."
)


def classify(descriptions: list[str], categories: list[str]) -> list[str | None]:
    n = len(descriptions)
    if not n or not categories or not settings.LLM_URL:
        return [None] * n
    numbered = "\n".join(f"{i}. {d}" for i, d in enumerate(descriptions, 1))
    prompt = f"Categorias: {', '.join(categories)}\n\nCompras:\n{numbered}"
    body = {
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "cats",
                "schema": {
                    "type": "array",
                    "items": {"enum": categories},
                    "minItems": n,
                    "maxItems": n,
                },
            },
        },
    }
    req = urllib.request.Request(
        f"{settings.LLM_URL.rstrip('/')}/v1/chat/completions",
        json.dumps(body).encode(),
        {"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.LLM_TIMEOUT) as r:  # noqa: S310
            content = json.load(r)["choices"][0]["message"]["content"]
        answer = json.loads(content)
        if not isinstance(answer, list) or len(answer) != n:
            raise ValueError(f"esperado array com {n} itens")
    except Exception as exc:  # noqa: BLE001 — import nunca falha por causa do LLM
        logger.warning("Classificação LLM indisponível: %s", exc)
        return [None] * n
    return [a if a in categories else None for a in answer]
