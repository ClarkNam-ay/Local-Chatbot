import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt
def chat(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_message = data.get("message")

            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "clark-assistant",
                    "prompt": user_message,
                    "stream": False
                }
            )

            result = response.json()

            return JsonResponse({
                "response": result.get("response", "No response from AI")
            })

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)