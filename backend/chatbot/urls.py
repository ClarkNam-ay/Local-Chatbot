from django.urls import path
from .views import chat, get_conversations, get_messages

urlpatterns = [
    path('chat/', chat),
    path('conversations/', get_conversations),
    path('messages/<int:conversation_id>/', get_messages),
]