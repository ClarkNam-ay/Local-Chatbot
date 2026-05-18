from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import Client
from django.test import TestCase, override_settings

from .models import Conversation, Message


@override_settings(
    CHATBOT_API_TOKEN="test-token",
    CHATBOT_REQUIRE_API_TOKEN=True,
    CHATBOT_MAX_MESSAGE_CHARS=50,
    CHATBOT_DEFAULT_MODEL_ID="local",
    CHATBOT_ASSISTANT_NAME="ChucksGPT",
    CHATBOT_RATE_LIMIT_REQUESTS=100,
    CHATBOT_RATE_LIMIT_WINDOW_SECONDS=60,
    CHATBOT_TRUST_X_FORWARDED_FOR=False,
    OLLAMA_MODEL="test-model",
    OLLAMA_TIMEOUT_SECONDS=1,
    OLLAMA_URL="http://ollama.test/api/generate",
    GEMINI_API_KEY="",
    GROQ_API_KEY="",
)
class ChatbotApiSecurityTests(TestCase):
    def setUp(self):
        cache.clear()

    def auth_headers(self):
        return {"HTTP_X_CHATBOT_TOKEN": "test-token"}

    def test_conversations_requires_api_token(self):
        response = self.client.get("/api/conversations/")

        self.assertEqual(response.status_code, 401)

    def test_csrf_endpoint_returns_header_token(self):
        response = self.client.get("/api/csrf/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["csrfToken"])

    def test_chat_rejects_empty_message(self):
        response = self.client.post(
            "/api/chat/",
            data={"message": "   "},
            content_type="application/json",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "message cannot be empty.")

    @patch("chatbot.llm_providers.requests.post")
    def test_chat_uses_default_ollama_model_before_saving_bot_response(self, post_mock):
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
        self.assertEqual(response.json()["model_id"], "local")
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertTrue(Conversation.objects.first().session_key)
        self.assertEqual(Message.objects.count(), 2)
        post_mock.assert_called_once()
        self.assertEqual(post_mock.call_args.kwargs["timeout"], 1)
        self.assertEqual(post_mock.call_args.kwargs["json"]["model"], "test-model")
        self.assertIn(
            "powered by the local Ollama model test-model",
            post_mock.call_args.kwargs["json"]["prompt"],
        )

    def test_chat_rejects_unknown_model_id_before_creating_conversation(self):
        response = self.client.post(
            "/api/chat/",
            data={"message": "Hello", "model_id": "unknown"},
            content_type="application/json",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Unsupported model selection.")
        self.assertEqual(Conversation.objects.count(), 0)

    @override_settings(
        GEMINI_API_KEY="gemini-key",
        GEMINI_API_BASE_URL="https://gemini.test/v1beta",
        GEMINI_MODEL="gemini-test",
        GEMINI_TIMEOUT_SECONDS=2,
    )
    @patch("chatbot.llm_providers.requests.post")
    def test_chat_can_use_selected_gemini_model(self, post_mock):
        gemini_response = Mock()
        gemini_response.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": "Gemini says hello"}]}}
            ]
        }
        gemini_response.raise_for_status.return_value = None
        post_mock.return_value = gemini_response

        response = self.client.post(
            "/api/chat/",
            data={"message": "Who are you?", "model_id": "gemini"},
            content_type="application/json",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["response"], "Gemini says hello")
        self.assertEqual(response.json()["model_id"], "gemini")
        post_mock.assert_called_once()
        self.assertEqual(
            post_mock.call_args.args[0],
            "https://gemini.test/v1beta/models/gemini-test:generateContent",
        )
        self.assertEqual(post_mock.call_args.kwargs["timeout"], 2)
        self.assertEqual(
            post_mock.call_args.kwargs["headers"]["x-goog-api-key"],
            "gemini-key",
        )
        payload = post_mock.call_args.kwargs["json"]
        self.assertIn(
            "powered by Gemini (gemini-test)",
            payload["system_instruction"]["parts"][0]["text"],
        )
        self.assertEqual(payload["contents"][0]["role"], "user")

    @override_settings(
        GROQ_API_KEY="groq-key",
        GROQ_CHAT_COMPLETIONS_URL="https://groq.test/openai/v1/chat/completions",
        GROQ_MODEL="groq-test",
        GROQ_TIMEOUT_SECONDS=3,
    )
    @patch("chatbot.llm_providers.requests.post")
    def test_chat_can_use_selected_groq_model(self, post_mock):
        groq_response = Mock()
        groq_response.json.return_value = {
            "choices": [{"message": {"content": "Groq says hello"}}]
        }
        groq_response.raise_for_status.return_value = None
        post_mock.return_value = groq_response

        response = self.client.post(
            "/api/chat/",
            data={"message": "Who are you?", "model_id": "groq"},
            content_type="application/json",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["response"], "Groq says hello")
        self.assertEqual(response.json()["model_id"], "groq")
        post_mock.assert_called_once()
        self.assertEqual(
            post_mock.call_args.args[0],
            "https://groq.test/openai/v1/chat/completions",
        )
        self.assertEqual(post_mock.call_args.kwargs["timeout"], 3)
        self.assertEqual(
            post_mock.call_args.kwargs["headers"]["Authorization"],
            "Bearer groq-key",
        )
        payload = post_mock.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "groq-test")
        self.assertIn(
            "powered by Groq (groq-test)",
            payload["messages"][0]["content"],
        )

    @patch("chatbot.llm_providers.requests.post")
    def test_conversations_are_scoped_to_browser_session(self, post_mock):
        ollama_response = Mock()
        ollama_response.json.return_value = {"response": "Private reply"}
        ollama_response.raise_for_status.return_value = None
        post_mock.return_value = ollama_response

        create_response = self.client.post(
            "/api/chat/",
            data={"message": "Keep this private"},
            content_type="application/json",
            **self.auth_headers(),
        )
        conversation_id = create_response.json()["conversation_id"]

        other_client = Client()
        messages_response = other_client.get(
            f"/api/messages/{conversation_id}/",
            **self.auth_headers(),
        )
        conversations_response = other_client.get(
            "/api/conversations/",
            **self.auth_headers(),
        )

        self.assertEqual(messages_response.status_code, 404)
        self.assertEqual(conversations_response.json(), [])

    @override_settings(CHATBOT_RATE_LIMIT_REQUESTS=1)
    @patch("chatbot.llm_providers.requests.post")
    def test_chat_rate_limit_blocks_excess_requests(self, post_mock):
        ollama_response = Mock()
        ollama_response.json.return_value = {"response": "Hello back"}
        ollama_response.raise_for_status.return_value = None
        post_mock.return_value = ollama_response

        first_response = self.client.post(
            "/api/chat/",
            data={"message": "Hello"},
            content_type="application/json",
            **self.auth_headers(),
        )
        second_response = self.client.post(
            "/api/chat/",
            data={"message": "Again"},
            content_type="application/json",
            **self.auth_headers(),
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 429)

    def test_delete_requires_existing_conversation(self):
        response = self.client.delete(
            "/api/conversation/999/delete/",
            **self.auth_headers(),
        )

        self.assertEqual(response.status_code, 404)
