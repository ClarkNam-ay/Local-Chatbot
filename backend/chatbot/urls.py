from django.urls import path
from .views import chat, get_conversations, get_messages, rename_conversation, delete_conversation

urlpatterns = [
    path('chat/', chat),
    path('conversations/', get_conversations),
    path('messages/<int:conversation_id>/', get_messages),
    path('conversation/<int:id>/rename/', rename_conversation),
    path('conversation/<int:id>/delete/', delete_conversation),
]