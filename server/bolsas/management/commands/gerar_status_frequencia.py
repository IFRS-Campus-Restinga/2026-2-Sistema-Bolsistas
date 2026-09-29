"""
Management command: gerar_status_frequencia

Para cada VinculoBolsista ATIVO cujo mês de referência (mês atual ou anterior)
passou do dia_limite_frequencia do edital sem lançamento, cria ou atualiza a
Frequencia para NAO_INFORMADA.

Idempotente: rodar N vezes não duplica registros.

Uso:
    python manage.py gerar_status_frequencia
    python manage.py gerar_status_frequencia --mes 2026-09  # mês específico (YYYY-MM)

Agendamento: cron externo ou Celery-beat (não implementado aqui).
"""

import calendar
import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.auditoria import registrar_acao
from bolsas.models import Frequencia, StatusFrequencia, StatusVinculo, VinculoBolsista


class Command(BaseCommand):
    help = "Gera status NAO_INFORMADA para frequências não lançadas após o prazo."

    def add_arguments(self, parser):
        parser.add_argument(
            "--mes",
            type=str,
            default=None,
            help="Mês de referência no formato YYYY-MM (padrão: mês atual).",
        )

    def handle(self, *args, **options):
        hoje = timezone.localdate()
        mes_arg = options.get("mes")

        if mes_arg:
            try:
                ano, mes = map(int, mes_arg.split("-"))
                mes_referencia = datetime.date(ano, mes, 1)
            except (ValueError, TypeError):
                self.stderr.write(self.style.ERROR(f"Formato inválido: {mes_arg}. Use YYYY-MM."))
                return
        else:
            mes_referencia = hoje.replace(day=1)

        self.stdout.write(f"Processando frequências para {mes_referencia:%m/%Y}...")

        geradas = 0
        ignoradas = 0

        vinculos_ativos = VinculoBolsista.objects.filter(
            status=StatusVinculo.ATIVO,
        ).select_related("bolsa__edital", "aluno")

        for vinculo in vinculos_ativos:
            edital = vinculo.bolsa.edital
            dia_limite = edital.dia_limite_frequencia

            if dia_limite is None:
                # Sem prazo configurado → não gerar NAO_INFORMADA
                ignoradas += 1
                continue

            # Calcular último dia do mês de referência para validar dia_limite
            ultimo_dia = calendar.monthrange(mes_referencia.year, mes_referencia.month)[1]
            dia_limite_efetivo = min(dia_limite, ultimo_dia)
            data_limite = mes_referencia.replace(day=dia_limite_efetivo)

            if hoje <= data_limite:
                # Prazo ainda não passou
                ignoradas += 1
                continue

            # Verificar se já existe frequência informada ou NAO_INFORMADA para este mês
            try:
                frequencia = Frequencia.objects.get(
                    vinculo=vinculo,
                    mes_referencia=mes_referencia,
                )
                if frequencia.status != StatusFrequencia.PENDENTE:
                    # Já tratada (INFORMADA ou NAO_INFORMADA)
                    ignoradas += 1
                    continue
                # Atualizar PENDENTE → NAO_INFORMADA
                frequencia.status = StatusFrequencia.NAO_INFORMADA
                frequencia.save(update_fields=["status"])
            except Frequencia.DoesNotExist:
                frequencia = Frequencia.objects.create(
                    vinculo=vinculo,
                    mes_referencia=mes_referencia,
                    status=StatusFrequencia.NAO_INFORMADA,
                )

            registrar_acao(
                ator=vinculo.aluno,  # ator = bolsista afetado (sistema gerou)
                acao="Frequência marcada como Não Informado (automático)",
                objeto=frequencia,
                detalhe=f"Prazo: dia {dia_limite} de {mes_referencia:%m/%Y}.",
            )
            geradas += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Concluído: {geradas} frequência(s) marcada(s) como Não Informado; "
                f"{ignoradas} ignorada(s) (prazo não vencido ou sem limite configurado)."
            )
        )
