from django.views import View
from django.views.generic.detail import SingleObjectMixin
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
import json
from http import HTTPStatus
from menu.models import Section, Item
from menu.forms import SectionForm, ItemForm


class MenuView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return JsonResponse({'sections': [section.serialize(True) for section in Section.objects.all()]})
        else:
            return JsonResponse({'sections': [section.serialize() for section in Section.objects.filter(visible=True)]})


class MenuSectionsView(LoginRequiredMixin, View):
    raise_exception = True

    def post(self, request):
        if not request.user.has_perm('menu.add_section'):
            raise PermissionDenied

        data = json.loads(request.body)
        section_form = SectionForm(data,)
        if section_form.is_valid():
            section = section_form.save()
            return JsonResponse(section.serialize(True))
        else:
            return JsonResponse({'error': 'Please correct errors.', 'errors': section_form.errors}, status=400)


class MenuSectionEditView(SingleObjectMixin, LoginRequiredMixin, View):
    raise_exception = True
    model = Section

    def delete(self, request, **kwargs):
        if not request.user.has_perm('menu.delete_section'):
            raise PermissionDenied

        section = self.get_object()
        section.delete()

        return JsonResponse({}, status=HTTPStatus.NO_CONTENT)

    def patch(self, request, **kwargs):
        if not request.user.has_perm('menu.change_section'):
            raise PermissionDenied

        section = self.get_object()
        data = json.loads(request.body)
        section_form = SectionForm(data, instance=section)
        if section_form.is_valid():
            section = section_form.save()
            return JsonResponse(section.serialize(True))
        else:
            return JsonResponse({'error': 'Please correct errors.', 'errors': section_form.errors}, status=400)

    def post(self, request, **kwargs):
        # Use post to handle move up/down requests
        if not request.user.has_perm('menu.change_section'):
            raise PermissionDenied

        section = self.get_object()

        data = json.loads(request.body)
        moved = False
        if 'up' in data:
            moved = section.move_up()
        elif 'down' in data:
            moved = section.move_down()
        else:
            return JsonResponse({'error': 'Direction not specified.'}, status=HTTPStatus.BAD_REQUEST)

        if moved:
            return JsonResponse({}, status=HTTPStatus.NO_CONTENT)
        else:
            return JsonResponse({'error': 'Unable to move section.'}, status=HTTPStatus.BAD_REQUEST)


class MenuItemsView(LoginRequiredMixin, View):
    raise_exception = True

    def post(self, request):
        if not request.user.has_perm('menu.view_item'):
            raise PermissionDenied

        data = json.loads(request.body)
        item_form = ItemForm(data,)
        if item_form.is_valid():
            item = item_form.save()
            return JsonResponse({'id': item.id,
                                 'name': item.name,
                                 'description': item.description,
                                 'price': item.price,
                                 'vat': item.vat,
                                 'order': item.order,
                                 'visible': item.visible})
        else:
            return JsonResponse({'error': 'Please correct errors.', 'errors': item_form.errors}, status=400)


class MenuItemEditView(SingleObjectMixin, LoginRequiredMixin, View):
    raise_exception = True
    model = Item

    def delete(self, request, **kwargs):
        if not request.user.has_perm('menu.delete_item'):
            raise PermissionDenied

        item = self.get_object()
        item.delete()

        return JsonResponse({}, status=HTTPStatus.NO_CONTENT)

    def patch(self, request, **kwargs):
        if not request.user.has_perm('menu.change_item'):
            raise PermissionDenied

        item = self.get_object()
        data = json.loads(request.body)
        item_form = ItemForm(data, instance=item)
        if item_form.is_valid():
            item = item_form.save()
            return JsonResponse({'id': item.id,
                                 'name': item.name,
                                 'description': item.description,
                                 'price': item.price,
                                 'vat': item.vat,
                                 'order': item.order,
                                 'visible': item.visible})
        else:
            return JsonResponse({'error': 'Please correct errors.', 'errors': item_form.errors}, status=400)

    def post(self, request, **kwargs):
        # Use post to handle move up/down requests
        if not request.user.has_perm('menu.change_item'):
            raise PermissionDenied

        item = self.get_object()

        data = json.loads(request.body)
        moved = False
        if 'up' in data:
            moved = item.move_up()
        elif 'down' in data:
            moved = item.move_down()
        else:
            return JsonResponse({'error': 'Direction not specified.'}, status=HTTPStatus.BAD_REQUEST)

        if moved:
            return JsonResponse({}, status=HTTPStatus.NO_CONTENT)
        else:
            return JsonResponse({'error': 'Unable to move item.'}, status=HTTPStatus.BAD_REQUEST)
