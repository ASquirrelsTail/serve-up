from django.views import View
from django.views.generic.base import TemplateView
from django.views.generic.detail import SingleObjectMixin
from django.http import JsonResponse
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from datetime import date
import json
from http import HTTPStatus

from tables.views import TableMixin
from visitors.views import HasGroupMixin

from orders.models import Order
from orders.forms import OrderItemForm


class TableOrderView(HasGroupMixin, TableMixin, View):
    def get(self, request, **kwargs):
        '''
        Return a json response containing a list of the groups orders.
        '''
        orders = [order.serialize() for order in self.group.order_set.all()]

        return JsonResponse({'orders': orders})

    def post(self, request, **kwargs):
        '''
        Create a new order.
        '''
        data = json.loads(request.body)

        if 'order' not in data or not isinstance(data['order'], list) or len(data['order']) < 1:
            return JsonResponse({'error': 'Please submit an order containing at least one item.'},
                                status=HTTPStatus.BAD_REQUEST)

        order_items = [OrderItemForm(order_item) for order_item in data['order']]

        valid = True
        for order_item_form in order_items:
            if not order_item_form.is_valid():
                valid = False

        if not valid:
            return JsonResponse({'error': 'Please correct errors with order item details',
                                 'item_errors': [order_item_form.errors for order_item_form in order_items]},
                                status=HTTPStatus.BAD_REQUEST)

        order = Order.objects.create(group=self.group)

        for order_item_form in order_items:
            order_item = order_item_form.save(commit=False)
            order_item.order = order
            order_item.save()

        return JsonResponse({}, status=HTTPStatus.NO_CONTENT)


class DailyOrdersView(LoginRequiredMixin, View):
    raise_exception = True

    def get(self, request):
        return JsonResponse({'orders': [order.serialize() for order in Order.objects.filter(time__gt=date.today())]})


class OrderView(LoginRequiredMixin, PermissionRequiredMixin, SingleObjectMixin, View):
    model = Order
    permission_required = 'orders.change_order'
    raise_exception = True

    def patch(self, request, **kwargs):
        order = self.get_object()
        data = json.loads(request.body)

        if 'accepted' in data:
            order.accepted = data['accepted']
        if 'completed' in data:
            order.completed = data['completed']
        if 'paid' in data:
            order.paid = data['paid']

        order.staff_member = request.user

        order.save()

        return JsonResponse(order.serialize())


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'index.html'
    login_url = '/admin/login/'
