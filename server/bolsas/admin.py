from django.contrib import admin

from .models import Bolsa

@admin.register(Bolsa)
class BolsaAdmin(admin.ModelAdmin):
    list_display = ["id", "solicitante", "modalidade", "carga_horaria_semanal", "status"]
    list_filter = ["status", "modalidade"]