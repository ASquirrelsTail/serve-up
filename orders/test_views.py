from django.urls import reverse
from django.test import TestCase
from django.contrib.auth.models import User, Permission, AnonymousUser

from tables.models import Table
from menu.models import Item
from orders.models import Order
from visitors.models import Group


class TableOrderViewTestCase(TestCase):
    '''
    Tests for OrderView for creating a new order.
    '''

    @classmethod
    def setUpTestData(cls):
        cls.table = Table.objects.create(name='Test')
        cls.url = reverse('table-order', kwargs={'slug': cls.table.uuid})

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


class UpdateOrderViewTestCase(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.test_user = User.objects.create_user(username='TestUser', email='test@test.com',
                                                 password='tH1$isA7357')
        cls.test_user.user_permissions.add(Permission.objects.get(codename='change_order'))

        cls.admin_user = User.objects.create_user(username='AdminUser', email='admin@test.com',
                                                  password='tH1$isA7357')
        cls.admin_user.user_permissions.set(Permission.objects.all())

        cls.other_user = User.objects.create_user(username='OtherUser', email='other@test.com',
                                                  password='tH1$isA7357')

        table = Table.objects.create(name='Test')
        cls.group = Group.objects.create(table=table)

    def setUp(self):
        self.client.logout()

    def patch(self, data, id):
        url = reverse('order', kwargs={'pk': id})
        return self.client.patch(url, data, content_type='application/json')

    def test_updating_order_returns_403_for_anonymous_and_user_without_permissions(self):
        order = Order.objects.create(group=self.group)

        response = self.patch({'paid': True}, order.id)
        self.assertEqual(response.status_code, 403)
        order.refresh_from_db()
        self.assertFalse(order.paid)

        self.client.login(username='OtherUser', password='tH1$isA7357')

        response = self.patch({'paid': True}, order.id)
        self.assertEqual(response.status_code, 403)
        order.refresh_from_db()
        self.assertFalse(order.paid)

    def test_updating_order_returns_succeeds_for_admin_and_user_with_permissions(self):
        order = Order.objects.create(group=self.group)
        self.client.login(username='AdminUser', password='tH1$isA7357')

        response = self.patch({'paid': True}, order.id)
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertTrue(order.paid)

        self.client.logout()
        order = Order.objects.create(group=self.group)
        self.client.login(username='TestUser', password='tH1$isA7357')

        response = self.patch({'paid': True}, order.id)
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertTrue(order.paid)

    def test_successfully_udating_order_returns_order_details(self):
        order = Order.objects.create(group=self.group)
        self.client.login(username='AdminUser', password='tH1$isA7357')

        response = self.patch({'paid': True}, order.id)
        updated_order = response.json()
        order.refresh_from_db()
        self.assertEqual(updated_order['paid'], order.paid)
        self.assertEqual(updated_order['id'], order.id)
        self.assertEqual(updated_order['group'], str(order.group))
