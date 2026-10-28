from django.db import migrations


def copiar_cultivo_a_m2m(apps, schema_editor):
    Sensor = apps.get_model('monitoreo', 'Sensor')
    # Usamos datos históricos tal como estaban al momento de migrar
    for sensor in Sensor.objects.select_related('dispositivo').all():
        dispositivo = getattr(sensor, 'dispositivo', None)
        if not dispositivo:
            continue
        cultivo = getattr(dispositivo, 'cultivo', None)
        if cultivo_id := getattr(cultivo, 'pk', None):
            sensor.cultivos.add(cultivo_id)


def revertir(apps, schema_editor):
    Sensor = apps.get_model('monitoreo', 'Sensor')
    for sensor in Sensor.objects.all():
        sensor.cultivos.clear()


class Migration(migrations.Migration):

    dependencies = [
        ('monitoreo', '0003_sensor_cultivos_sensor_is_active'),
    ]

    operations = [
        migrations.RunPython(copiar_cultivo_a_m2m, reverse_code=revertir),
    ]
