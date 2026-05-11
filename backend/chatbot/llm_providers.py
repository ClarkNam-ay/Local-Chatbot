from urllib.parse import quote

import requests
from django.conf import settings


DEFAULT_MODEL_ID = "local"

CHAT_MODEL_OPTIONS = {
    "local": {
        "label": "ChucksGPT Local",
        "engine": "Ollama",
    },
    "gemini": {
        "label": "ChucksGPT Gemini",
        "engine": "Gemini",
    },
    "groq": {
        "label": "ChucksGPT Groq",
        "engine": "Groq",
    },
}


class ProviderError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.message = message
        self.status = status


def resolve_chat_model_id(value):
    if value is None:
        configured_default = getattr(
            settings,
            "CHATBOT_DEFAULT_MODEL_ID",
            DEFAULT_MODEL_ID,
        )
        value = (
            configured_default
            if configured_default.strip().lower() in CHAT_MODEL_OPTIONS
            else DEFAULT_MODEL_ID
        )

    if not isinstance(value, str):
        raise ProviderError("model_id must be text.", status=400)

    model_id = value.strip().lower() or DEFAULT_MODEL_ID
    if model_id not in CHAT_MODEL_OPTIONS:
        raise ProviderError("Unsupported model selection.", status=400)

    return model_id


def _assistant_name():
    configured_name = getattr(
        settings,
        "CHATBOT_ASSISTANT_NAME",
        "ChucksGPT",
    ).strip()
    return configured_name or "ChucksGPT"


def _gemini_model_path():
    model = settings.GEMINI_MODEL.strip()
    if model.startswith("models/"):
        model = model.removeprefix("models/")
    return quote(model, safe="")


def _powered_by(model_id):
    if model_id == "gemini":
        return f"Gemini ({settings.GEMINI_MODEL})"
    if model_id == "groq":
        return f"Groq ({settings.GROQ_MODEL})"
    return f"the local Ollama model {settings.OLLAMA_MODEL}"


def _persona_prompt(model_id):
    assistant_name = _assistant_name()
    return (
        f"You are {assistant_name}, Sir Clark's helpful AI assistant. "
        "Keep a consistent ChucksGPT personality across every model: warm, clear, "
        "practical, and concise unless the user asks for more detail. "
        "If the user asks who you are or what model powers you, answer naturally as: "
        f"\"I'm {assistant_name}, powered by {_powered_by(model_id)}.\" "
        "Do not claim to be a generic model provider; the assistant identity is "
        f"always {assistant_name}."
    )


def _post_json(url, payload, timeout, provider_name, headers=None):
    try:
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=timeout,
        )
        response.raise_for_status()
        return response.json()
    except requests.Timeout:
        raise ProviderError(f"{provider_name} timed out.", status=504)
    except requests.RequestException:
        raise ProviderError(f"{provider_name} request failed.", status=502)
    except ValueError:
        raise ProviderError(f"{provider_name} returned invalid JSON.", status=502)


def _recent_history(messages):
    return [
        {
            "sender": message.sender,
            "text": message.text,
        }
        for message in messages
    ]


def generate_chat_reply(model_id, messages):
    history = _recent_history(messages)
    persona = _persona_prompt(model_id)

    if model_id == "gemini":
        return _generate_gemini_reply(history, persona)
    if model_id == "groq":
        return _generate_groq_reply(history, persona)

    return _generate_ollama_reply(history, persona)


def _generate_ollama_reply(history, persona):
    context_lines = [f"System: {persona}"]
    for message in history:
        role = "User" if message["sender"] == "user" else "Assistant"
        context_lines.append(f"{role}: {message['text']}")

    context = "\n".join(context_lines) + "\nAssistant:"
    result = _post_json(
        settings.OLLAMA_URL,
        {
            "model": settings.OLLAMA_MODEL,
            "prompt": context,
            "stream": False,
        },
        settings.OLLAMA_TIMEOUT_SECONDS,
        "The local model",
    )

    return _extract_text_response(result.get("response"), "The local model")


def _generate_gemini_reply(history, persona):
    if not settings.GEMINI_API_KEY:
        raise ProviderError(
            "Gemini API key is not configured on the backend.",
            status=503,
        )

    contents = [
        {
            "role": "model" if message["sender"] == "bot" else "user",
            "parts": [{"text": message["text"]}],
        }
        for message in history
    ]
    url = (
        f"{settings.GEMINI_API_BASE_URL.rstrip('/')}/models/"
        f"{_gemini_model_path()}:generateContent"
    )
    result = _post_json(
        url,
        {
            "system_instruction": {"parts": [{"text": persona}]},
            "contents": contents,
        },
        settings.GEMINI_TIMEOUT_SECONDS,
        "Gemini",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.GEMINI_API_KEY,
        },
    )

    candidates = result.get("candidates")
    if isinstance(candidates, list):
        for candidate in candidates:
            content = candidate.get("content") if isinstance(candidate, dict) else None
            parts = content.get("parts") if isinstance(content, dict) else None
            if isinstance(parts, list):
                text = "".join(
                    part.get("text", "")
                    for part in parts
                    if isinstance(part, dict) and isinstance(part.get("text"), str)
                ).strip()
                if text:
                    return text

    raise ProviderError("Gemini returned an empty response.", status=502)


def _generate_groq_reply(history, persona):
    if not settings.GROQ_API_KEY:
        raise ProviderError(
            "Groq API key is not configured on the backend.",
            status=503,
        )

    messages = [{"role": "system", "content": persona}]
    messages.extend(
        {
            "role": "assistant" if message["sender"] == "bot" else "user",
            "content": message["text"],
        }
        for message in history
    )
    result = _post_json(
        settings.GROQ_CHAT_COMPLETIONS_URL,
        {
            "model": settings.GROQ_MODEL,
            "messages": messages,
        },
        settings.GROQ_TIMEOUT_SECONDS,
        "Groq",
        headers={
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
    )

    choices = result.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(message, dict):
            return _extract_text_response(message.get("content"), "Groq")

    raise ProviderError("Groq returned an empty response.", status=502)


def _extract_text_response(value, provider_name):
    if isinstance(value, str) and value.strip():
        return value.strip()

    raise ProviderError(f"{provider_name} returned an empty response.", status=502)
