from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.usuarios.models import Usuario


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["rol"] = user.rol
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["rol"] = self.user.rol
        data["username"] = self.user.username
        return data


class UsuarioMeSerializer(serializers.ModelSerializer):
    """Lo que devuelve /api/usuarios/me/ — para que el frontend sepa el rol."""
    class Meta:
        model = Usuario
        fields = ["id", "username", "email", "rol", "is_superuser", "is_active"]


class UsuarioSerializer(serializers.ModelSerializer):
    """Para que el admin gestione usuarios (RF-02)."""
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Usuario
        fields = ["id", "username", "email", "rol", "is_active", "password"]

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