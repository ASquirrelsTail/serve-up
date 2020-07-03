from django.views import View
from django.views.generic.detail import SingleObjectMixin
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.core.exceptions import PermissionDenied
import json
from http import HTTPStatus

from tables.models import Table
from tables.forms import TableForm


class TableMixin(SingleObjectMixin):
    model = Table
    slug_field = 'uuid'

    def get_table(self):
        return self.get_object()


class TablesView(LoginRequiredMixin, View):
    raise_exception = True

    def get(self, request):
        return JsonResponse({'tables': [{'id': table.id, 'name': table.name, 'uuid': table.uuid, 'img': table.img, 'url': table.url} for table in Table.objects.all()]})

    def post(self, request):
        if not request.user.has_perm('tables.add_table'):
            raise PermissionDenied

        data = json.loads(request.body)
        table_form = TableForm(data)
        if table_form.is_valid():
            table = table_form.save()
            return JsonResponse({'id': table.id, 'name': table.name, 'uuid': table.uuid, 'img': table.img, 'url': table.url})
        else:
            return JsonResponse({'error': table_form.errors['name']}, status=400)


class TableEditView(LoginRequiredMixin, SingleObjectMixin, View):
    raise_exception = True
    model = Table

    def get(self, request, **kwargs):
        table = self.get_object()
        return JsonResponse({'id': table.id, 'name': table.name, 'uuid': table.uuid, 'img': table.img, 'url': table.url})

    def delete(self, request, **kwargs):
        if not request.user.has_perm('tables.delete_table'):
            raise PermissionDenied

        table = self.get_object()
        table.delete()

        return JsonResponse({}, status=HTTPStatus.NO_CONTENT)

    def patch(self, request, **kwargs):
        if not request.user.has_perm('tables.change_table'):
            raise PermissionDenied

        table = self.get_object()
        data = json.loads(request.body)
        table_form = TableForm(data, instance=table)
        if table_form.is_valid():
            table = table_form.save()
            return JsonResponse({'id': table.id, 'name': table.name, 'uuid': table.uuid, 'img': table.img, 'url': table.url})
        else:
            return JsonResponse({'error': table_form.errors['name']}, status=400)
