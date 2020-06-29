from django.views import View
from django.http import JsonResponse
from menu.models import Section


class MenuView(View):
    def get(self, request):
        return JsonResponse({'sections': [section.serialize() for section in Section.objects.filter(visible=True)]})
