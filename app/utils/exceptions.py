class ChatbotError(Exception):
    """Base exception for chatbot domain errors."""


class ProjectNotFoundError(ChatbotError):
    pass


class IntentNotFoundError(ChatbotError):
    pass


class LanguageNotSupportedError(ChatbotError):
    pass


class InvalidIntentHierarchyError(ChatbotError):
    pass
