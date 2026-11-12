import io
import json
import urllib.error

from apps.transactions import classifier

CATS = ["Mercado", "Lazer", "Outros"]


def _fake_urlopen(answer, sent):
    def fake(req, timeout):
        sent.append(json.loads(req.data))
        body = {"choices": [{"message": {"content": answer}}]}
        return io.BytesIO(json.dumps(body).encode())

    return fake


def test_classify_parses_array_and_constrains_to_categories(monkeypatch, settings):
    settings.LLM_URL = "http://llm:8099"
    sent = []
    monkeypatch.setattr(
        classifier.urllib.request,
        "urlopen",
        _fake_urlopen(json.dumps(["Lazer", "Mercado"]), sent),
    )

    assert classifier.classify(["CINEMARK", "ATACADAO"], CATS) == ["Lazer", "Mercado"]
    schema = sent[0]["response_format"]["json_schema"]["schema"]
    assert schema["items"]["enum"] == CATS
    assert schema["minItems"] == schema["maxItems"] == 2


def test_classify_disabled_returns_nones(monkeypatch, settings):
    settings.LLM_URL = ""

    def boom(*a, **k):
        raise AssertionError("não deveria chamar")

    monkeypatch.setattr(classifier.urllib.request, "urlopen", boom)
    assert classifier.classify(["X", "Y"], CATS) == [None, None]


def test_classify_failures_return_nones(monkeypatch, settings):
    settings.LLM_URL = "http://llm:8099"

    def down(*a, **k):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(classifier.urllib.request, "urlopen", down)
    assert classifier.classify(["X"], CATS) == [None]

    for bad in ("não é json", json.dumps(["Lazer"]), json.dumps(["Inventada"])):
        monkeypatch.setattr(
            classifier.urllib.request, "urlopen", _fake_urlopen(bad, [])
        )
        assert classifier.classify(["X", "Y"], CATS) == [None, None]
