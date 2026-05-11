from django.urls import path

from .views import (
    chat,
    csrf,
    delete_conversation,
    get_conversations,
    get_messages,
    rename_conversation,
)

urlpatterns = [
    path('csrf/', csrf),
    path('chat/', chat),
    path('conversations/', get_conversations),
    path('messages/<int:conversation_id>/', get_messages),
    path('conversation/<int:id>/rename/', rename_conversation),
    path('conversation/<int:id>/delete/', delete_conversation),
]
