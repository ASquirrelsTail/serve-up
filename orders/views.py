from django.views import View
from django.http import JsonResponse
import json
from http import HTTPStatus

from tables.views import TableMixin
from visitors.views import HasGroupMixin

from orders.models import Order
from orders.forms import OrderItemForm


class OrderView(HasGroupMixin, TableMixin, View):
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
