from django.contrib.auth.models import update_last_login
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.auditoria.models import RegistroAuditoria
from apps.auditoria.services import registrar_auditoria
from apps.usuarios.models import Usuario


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["rol"] = user.rol
        token["username"] = user.username
        return token

    def validate(self, attrs):
        # Login fallido: se audita ANTES de relanzar el error. El usuario va a
        # NULL y el username intentado queda en detalles (puede que ni exista).
        try:
            data = super().validate(attrs)
        except (AuthenticationFailed, ValidationError):
            request = self.context.get("request")
            username = attrs.get("username", "")
            registrar_auditoria(
                request,
                RegistroAuditoria.Accion.LOGIN_FALLIDO,
                "Usuario",
                detalles={"username": username},
            )
            raise

        # Login OK. SimpleJWT no usa django.contrib.auth.login, por eso acá
        # request.user todavía es anónimo: se pasa el usuario explicito.
        request = self.context.get("request")
        registrar_auditoria(
            request,
            RegistroAuditoria.Accion.LOGIN,
            "Usuario",
            objeto_id=self.user.pk,
            detalles={"username": self.user.username, "rol": self.user.rol},
            usuario=self.user,
        )

        # SimpleJWT no actualiza last_login por sí solo (no usa django.contrib.auth.login).
        # Lo hacemos acá para que el campo refleje el último acceso real.
        update_last_login(None, self.user)
        data["rol"] = self.user.rol
        data["username"] = self.user.username
        return data


class UsuarioMeSerializer(serializers.ModelSerializer):
    """Lo que devuelve /api/usuarios/me/ — para que el frontend sepa el rol."""
    class Meta:
        model = Usuario
        fields = [
            "id", "username", "email", "rol", "is_superuser",
            "is_active", "last_login",
        ]


class UsuarioSerializer(serializers.ModelSerializer):
    """Para que el admin gestione usuarios (RF-02)."""
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Usuario
        fields = [
            "id", "username", "email", "rol", "is_active",
            "last_login", "date_joined", "password",
        ]
        read_only_fields = ["id", "last_login", "date_joined"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = Usuario(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
