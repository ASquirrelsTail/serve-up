from django.views import View
from django.http import JsonResponse
from menu.models import Item, Section


class MenuView(View):
    def get(self, request):
        menu_items = Item.objects.filter(section=None)
        if not request.user.is_authenticated:
            menu_items = menu_items.filter(visible=True).values('id', 'name', 'description', 'price', 'vat', 'order', 'visible')
        else:
            menu_items = menu_items.values('id', 'name', 'description', 'price', 'vat', 'order', 'visible')

        menu_items = list(menu_items)
        menu_sections = [section.serialize(request.user.is_authenticated) for section in Section.objects.filter(parent_section=None).all()]

        return JsonResponse({'items': menu_items + menu_sections})
