from django.contrib import admin
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion, Imagen

admin.site.register(TipoSensor)
admin.site.register(Sensor)
admin.site.register(RangoOperacion)
admin.site.register(Medicion)
admin.site.register(Imagen)