from django.urls import reverse
from django.test import TestCase

from tables.models import Table
from menu.models import Item
from orders.models import Order


class OrderViewTestCase(TestCase):
    '''
    Tests for OrderView for creating a new order.
    '''

    @classmethod
    def setUpTestData(cls):
        cls.table = Table.objects.create(name='Test')
        cls.url = reverse('order', kwargs={'slug': cls.table.uuid})

        menu_item_names = ['Bacon', 'Eggs', 'Toast', 'Coffee']
        cls.menu_items = [Item.objects.create(name=name) for name in menu_item_names]

    def setUp(self):
        self.client.session.clear()

    def post(self, data):
        return self.client.post(self.url, data, content_type='application/json')

    def create_group(self):
        self.client.post(reverse('group', kwargs={'slug': self.table.uuid}),
                         {'visitors': [{'name': 'John Doe', 'phone_number': '0161 496 0210', 'email': ''}]},
                         content_type='application/json')

    def test_visitor_cant_place_order_without_group(self):
        response = self.post({'order': [{'item': self.menu_items[0].id, 'count': 1}, {'item': self.menu_items[3].id, 'count': 2}]})
        self.assertEqual(response.status_code, 403)

        self.assertEqual(Order.objects.count(), 0)

    def test_returns_400_if_invalid_data_is_submitted(self):
        invalid_data = [
            {},
            {'order': []},
            {'order': 'Not an order'},
            {'order': [{'item': '', 'count': 1}]},
            {'order': [{'item': self.menu_items[0].id, 'count': 0}, {'item': self.menu_items[3].id, 'count': 2}]},
            {'order': [{'item': self.menu_items[0].id, 'count': 1}, {'item': self.menu_items[3].id, 'count': -3}]}
        ]

        self.create_group()

        for data in invalid_data:
            response = self.post(data)
            self.assertEqual(response.status_code, 400)
            self.assertTrue('error' in response.json())

            self.assertEqual(Order.objects.count(), 0)

    def test_returns_204_and_creates_order_if_order_created_successfully(self):
        self.create_group()
        response = self.post({'order': [{'item': self.menu_items[0].id, 'count': 1}, {'item': self.menu_items[3].id, 'count': 2}]})
        self.assertEqual(response.status_code, 204)

        self.assertEqual(Order.objects.count(), 1)
        order = Order.objects.get().serialize()

        self.assertEqual(order['order_items'][0]['item_id'], self.menu_items[0].id)
        self.assertEqual(order['order_items'][0]['count'], 1)
        self.assertEqual(order['order_items'][1]['item_id'], self.menu_items[3].id)
        self.assertEqual(order['order_items'][1]['count'], 2)
