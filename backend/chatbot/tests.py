from unittest.mock import Mock, patch

from django.test import TestCase, override_settings

from .models import Conversation, Message


@override_settings(
    CHATBOT_API_TOKEN="test-token",
    CHATBOT_REQUIRE_API_TOKEN=True,
    CHATBOT_MAX_MESSAGE_CHARS=50,
    OLLAMA_MODEL="test-model",
    OLLAMA_TIMEOUT_SECONDS=1,
    OLLAMA_URL="http://ollama.test/api/generate",
)
class ChatbotApiSecurityTests(TestCase):
    def auth_headers(self):
        return {"HTTP_X_CHATBOT_TOKEN": "test-token"}

    def test_conversations_requires_api_token(self):
        response = self.client.get("/api/conversations/")

        self.assertEqual(response.status_code, 401)

    def test_chat_rejects_empty_message(self):
        response = self.client.post(
            "/api/chat/",
            data={"message": "   "},
            content_type="application/json",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "message cannot be empty.")

    @patch("chatbot.views.requests.post")
    def test_chat_uses_token_and_timeout_before_saving_bot_response(self, post_mock):
        ollama_response = Mock()
        ollama_response.json.return_value = {"response": "Hello back"}
        ollama_response.raise_for_status.return_value = None
        post_mock.return_value = ollama_response

        response = self.client.post(
            "/api/chat/",
            data={"message": "Hello"},
            content_type="application/json",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["response"], "Hello back")
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)
        post_mock.assert_called_once()
        self.assertEqual(post_mock.call_args.kwargs["timeout"], 1)

    def test_delete_requires_existing_conversation(self):
        response = self.client.delete(
            "/api/conversation/999/delete/",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 404)
