from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from apps.eventos.management.commands.planificador import TAREAS


class PlanificadorTest(TestCase):
    def test_once_ejecuta_todas_las_tareas(self):
        with patch("apps.eventos.management.commands.planificador.call_command") as mock_cmd:
            call_command("planificador", "--once")
        ejecutadas = [c.args[0] for c in mock_cmd.call_args_list]
        self.assertEqual(ejecutadas, [nombre for nombre, _, _ in TAREAS])

    def test_una_tarea_que_falla_no_frena_a_las_demas(self):
        def falla_la_primera(nombre, *args):
            if nombre == TAREAS[0][0]:
                raise RuntimeError("boom")

        errores = StringIO()
        with patch("apps.eventos.management.commands.planificador.call_command",
                   side_effect=falla_la_primera) as mock_cmd:
            call_command("planificador", "--once", stderr=errores)
        self.assertEqual(mock_cmd.call_count, len(TAREAS))
        self.assertIn("falló", errores.getvalue())

    def test_las_tareas_configuradas_existen_como_comandos(self):
        from django.core.management import get_commands
        disponibles = get_commands()
        for nombre, _, _ in TAREAS:
            self.assertIn(nombre, disponibles)
