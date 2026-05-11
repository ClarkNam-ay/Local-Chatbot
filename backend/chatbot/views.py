import hmac
import json

import requests
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .models import Conversation, Message


def error_response(message, status=400):
    return JsonResponse({"error": message}, status=status)


def require_api_token(view_func):
    def wrapped(request, *args, **kwargs):
        if settings.CHATBOT_REQUIRE_API_TOKEN:
            provided_token = request.headers.get("X-Chatbot-Token", "")
            if not hmac.compare_digest(provided_token, settings.CHATBOT_API_TOKEN):
                return error_response("Unauthorized", status=401)

        return view_func(request, *args, **kwargs)

    return wrapped


def parse_json_body(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, error_response("Request body must be valid JSON.")

    if not isinstance(payload, dict):
        return None, error_response("Request body must be a JSON object.")

    return payload, None


def clean_text(value, field_name, max_length):
    if not isinstance(value, str):
        return None, error_response(f"{field_name} must be text.")

    value = value.strip()
    if not value:
        return None, error_response(f"{field_name} cannot be empty.")

    if len(value) > max_length:
        return None, error_response(
            f"{field_name} is too long. Limit it to {max_length} characters."
        )

    return value, None


@ensure_csrf_cookie
@require_GET
def csrf(request):
    return JsonResponse({"success": True})


@require_api_token
@require_POST
def chat(request):
    data, error = parse_json_body(request)
    if error:
        return error

    user_message, error = clean_text(
        data.get("message"), "message", settings.CHATBOT_MAX_MESSAGE_CHARS
    )
    if error:
        return error

    conversation_id = data.get("conversation_id")
    if conversation_id is not None and not isinstance(conversation_id, int):
        return error_response("conversation_id must be a number.")

    if conversation_id:
        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return error_response("Conversation not found.", status=404)

        if not conversation.title:
            conversation.title = user_message[:30]
            conversation.save(update_fields=["title"])
    else:
        conversation = Conversation.objects.create(title=user_message[:30])

    Message.objects.create(conversation=conversation, text=user_message, sender="user")

    recent_messages = Message.objects.filter(conversation=conversation).order_by(
        "-timestamp"
    )[:40]
    ordered_messages = reversed(list(recent_messages))

    context_lines = []
    for message in ordered_messages:
        role = "User" if message.sender == "user" else "Assistant"
        context_lines.append(f"{role}: {message.text}")

    context = "\n".join(context_lines) + "\nAssistant:"

    try:
        response = requests.post(
            settings.OLLAMA_URL,
            json={
                "model": settings.OLLAMA_MODEL,
                "prompt": context,
                "stream": False,
            },
            timeout=settings.OLLAMA_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        result = response.json()
    except requests.Timeout:
        return error_response("The local model timed out.", status=504)
    except requests.RequestException:
        return error_response("The local model request failed.", status=502)
    except ValueError:
        return error_response("The local model returned invalid JSON.", status=502)

    bot_reply = result.get("response")
    if not isinstance(bot_reply, str) or not bot_reply.strip():
        return error_response("The local model returned an empty response.", status=502)

    Message.objects.create(conversation=conversation, text=bot_reply, sender="bot")

    return JsonResponse(
        {
            "response": bot_reply,
            "conversation_id": conversation.id,
        }
    )


@require_api_token
@require_GET
def get_conversations(request):
    conversations = Conversation.objects.all().order_by("-created_at")

    data = [
        {
            "id": conversation.id,
            "title": conversation.title,
        }
        for conversation in conversations
    ]

    return JsonResponse(data, safe=False)


@require_api_token
@require_GET
def get_messages(request, conversation_id):
    if not Conversation.objects.filter(id=conversation_id).exists():
        return error_response("Conversation not found.", status=404)

    messages = Message.objects.filter(conversation_id=conversation_id).order_by(
        "timestamp"
    )

    data = [
        {
            "text": message.text,
            "sender": message.sender,
            "timestamp": message.timestamp,
        }
        for message in messages
    ]

    return JsonResponse(data, safe=False)


@require_api_token
@require_POST
def rename_conversation(request, id):
    data, error = parse_json_body(request)
    if error:
        return error

    new_title, error = clean_text(data.get("title"), "title", 80)
    if error:
        return error

    try:
        conversation = Conversation.objects.get(id=id)
    except Conversation.DoesNotExist:
        return error_response("Conversation not found.", status=404)

    conversation.title = new_title
    conversation.save(update_fields=["title"])

    return JsonResponse({"success": True})


@require_api_token
@require_http_methods(["DELETE"])
def delete_conversation(request, id):
    try:
        conversation = Conversation.objects.get(id=id)
    except Conversation.DoesNotExist:
        return error_response("Conversation not found.", status=404)

    conversation.delete()

    return JsonResponse({"success": True})
