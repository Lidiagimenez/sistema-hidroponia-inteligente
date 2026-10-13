import hashlib

from rest_framework.throttling import ScopedRateThrottle


class ApiKeyScopedRateThrottle(ScopedRateThrottle):
    """Throttle de ingesta por API key, sin guardar la clave en claro en cache."""

    def get_cache_key(self, request, view):
        if not self.scope:
            return None
        key = request.META.get("HTTP_X_API_KEY")
        if not key:
            return super().get_cache_key(request, view)
        ident = hashlib.sha256(key.encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": ident}
