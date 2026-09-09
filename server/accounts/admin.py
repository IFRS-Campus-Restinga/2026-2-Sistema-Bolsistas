from django.contrib import admin

from .models import Administrador, Aluno, CoordenadorArea, CoordenadorProjeto, Usuario

admin.site.register(Usuario)
admin.site.register(Aluno)
admin.site.register(CoordenadorProjeto)
admin.site.register(CoordenadorArea)
admin.site.register(Administrador)
