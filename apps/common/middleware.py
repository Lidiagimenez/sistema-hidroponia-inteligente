from django.conf import settings


class ContentSecurityPolicyMiddleware:
    """CSP compacta para el prototipo sin depender de paquetes externos."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        policy = getattr(settings, "CONTENT_SECURITY_POLICY", "")
        if policy:
            response.setdefault("Content-Security-Policy", policy)
        return response
