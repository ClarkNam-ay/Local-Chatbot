import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .models import Conversation, Message

# View to handle chat interactions----------------------------------------------------------------
@csrf_exempt
def chat(request):
    if request.method == "POST":
        data = json.loads(request.body)
        user_message = data.get("message")
        conversation_id = data.get("conversation_id")

        # Create or get conversation
        if conversation_id:
            conversation = Conversation.objects.get(id=conversation_id)

            # Update title if empty
            if not conversation.title:
                conversation.title = user_message[:30]
                conversation.save()
        else:
            conversation = Conversation.objects.create(title=user_message.strip()[:30])

        # Save user message
        Message.objects.create(
            conversation=conversation,
            text=user_message,
            sender="user"
        )

        # Build conversation context (AI Memory)
        messages = Message.objects.filter(conversation=conversation).order_by('-timestamp')[:10]
        messages = reversed(messages)

        context = ""

        for m in messages:
            role = "User" if m.sender == "user" else "Assistant"
            context += f"{role}: {m.text}\n"

        context += f"User: {user_message}\nAssistant:"

        # Call Ollama
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "clark-assistant",
                "prompt": context,
                "stream": False
            }
        )

        result = response.json()
        bot_reply = result.get("response", "")

        # Save bot message
        Message.objects.create(
            conversation=conversation,
            text=bot_reply,
            sender="bot"
        )

        return JsonResponse({
            "response": bot_reply,
            "conversation_id": conversation.id
        })
    
# Additional views to fetch conversations and messages-----------------------------------------------------
def get_conversations(request):
    conversations = Conversation.objects.all().order_by('-created_at')

    data = [
        {
            "id": c.id,
            "title": c.title
        }
        for c in conversations
    ]

    return JsonResponse(data, safe=False)

# View to fetch messages for a conversation-----------------------------------------------------
def get_messages(request, conversation_id):
    messages = Message.objects.filter(conversation_id=conversation_id)

    data = [
        {
            "text": m.text,
            "sender": m.sender,
            "timestamp": m.timestamp
        }
        for m in messages
    ]

    return JsonResponse(data, safe=False)

# Views to rename and delete conversations-----------------------------------------------------
@csrf_exempt
def rename_conversation(request, id):
    if request.method == "POST":
        data = json.loads(request.body)
        new_title = data.get("title")

        conversation = Conversation.objects.get(id=id)
        conversation.title = new_title
        conversation.save()

        return JsonResponse({"success": True})


@csrf_exempt
def delete_conversation(request, id):
    if request.method == "DELETE":
        conversation = Conversation.objects.get(id=id)
        conversation.delete()

        return JsonResponse({"success": True})
    