from django.urls import reverse
from django.test import TestCase
from django.contrib.auth.models import User, Permission

from tables.models import Table


class TablesViewTestCase(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.test_user = User.objects.create_user(username='TestUser', email='test@test.com',
                                                 password='tH1$isA7357')
        cls.test_user.user_permissions.add(Permission.objects.get(codename='add_table'))

        cls.admin_user = User.objects.create_user(username='AdminUser', email='admin@test.com',
                                                  password='tH1$isA7357')
        cls.admin_user.user_permissions.set(Permission.objects.all())

        cls.other_user = User.objects.create_user(username='OtherUser', email='other@test.com',
                                                  password='tH1$isA7357')

        cls.url = reverse('tables')

    def setUp(self):
        self.client.logout()

    def tearDown(self):
        Table.objects.all().delete()

    def post(self, data):
        return self.client.post(self.url, data, content_type='application/json')

    def test_creating_table_returns_403_for_anonymous_and_user_without_permissions(self):

        response = self.post({'name': 'test'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Table.objects.count(), 0)

        self.client.login(username='OtherUser', password='tH1$isA7357')

        response = self.post({'name': 'test'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Table.objects.count(), 0)

    def test_creating_table_returns_200_succeeds_for_admin_and_user_with_permissions(self):
        self.client.login(username='AdminUser', password='tH1$isA7357')

        response = self.post({'name': 'Test 1'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Table.objects.get(name='Test 1'))

        self.client.logout()

        self.client.login(username='TestUser', password='tH1$isA7357')

        response = self.post({'name': 'Test 2'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Table.objects.get(name='Test 2'))

    def test_successfully_creating_table_returns_table_object(self):
        self.client.login(username='AdminUser', password='tH1$isA7357')

        response = self.post({'name': 'Test 1'})
        self.assertEqual(response.json()['name'], 'Test 1')
        self.assertTrue('id' in response.json())
        self.assertTrue('url' in response.json())

    def test_creating_table_with_invalid_data_returns_400_with_error(self):
        invalid_data = [
            {},
            {'name': ''},
            {'not_a_name': 'Not a name'},
        ]

        self.client.login(username='AdminUser', password='tH1$isA7357')

        for data in invalid_data:
            response = self.post(data)
            self.assertEqual(response.status_code, 400)
            self.assertTrue('error' in response.json())
            self.assertEqual(Table.objects.count(), 0)

    def test_creating_table_creates_corresponding_qrcode(self):
        pass  # Can't test static files
        # self.client.login(username='AdminUser', password='tH1$isA7357')

        # self.post({'name': 'Test Image'})
        # response = self.client.get(Table.objects.get(name='Test Image').img)
        # self.assertEqual(response.status_code, 200)


class TableEditViewTestCase(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.update_user = User.objects.create_user(username='UpdateUser', email='test@test.com',
                                                   password='tH1$isA7357')
        cls.update_user.user_permissions.add(Permission.objects.get(codename='change_table'))

        cls.delete_user = User.objects.create_user(username='DeleteUser', email='test@test.com',
                                                   password='tH1$isA7357')
        cls.delete_user.user_permissions.add(Permission.objects.get(codename='delete_table'))

        cls.admin_user = User.objects.create_user(username='AdminUser', email='admin@test.com',
                                                  password='tH1$isA7357')
        cls.admin_user.user_permissions.set(Permission.objects.all())

        cls.other_user = User.objects.create_user(username='OtherUser', email='other@test.com',
                                                  password='tH1$isA7357')

    def setUp(self):
        self.client.logout()

    def tearDown(self):
        Table.objects.all().delete()

    def patch(self, data, id):
        url = reverse('table-edit', kwargs={'pk': id})
        return self.client.patch(url, data, content_type='application/json')

    def delete(self, id):
        url = reverse('table-edit', kwargs={'pk': id})
        return self.client.delete(url, content_type='application/json')

    def test_editing_or_deleteing_table_returns_403_for_anonymous_and_users_without_permissions(self):
        table = Table.objects.create(name='Test')

        response = self.patch({'name': 'Edited'}, table.id)
        self.assertEqual(response.status_code, 403)
        self.assertNotEqual(Table.objects.get(pk=table.id).name, 'Edited')

        response = self.delete(table.id)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Table.objects.count(), 1)

        self.client.login(username='OtherUser', password='tH1$isA7357')

        response = self.patch({'name': 'Edited'}, table.id)
        self.assertEqual(response.status_code, 403)
        self.assertNotEqual(Table.objects.get(pk=table.id).name, 'Edited')

        response = self.delete(table.id)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Table.objects.count(), 1)

        self.client.login(username='DeleteUser', password='tH1$isA7357')

        response = self.patch({'name': 'Edited'}, table.id)
        self.assertEqual(response.status_code, 403)
        self.assertNotEqual(Table.objects.get(pk=table.id).name, 'Edited')

        self.client.login(username='UpdateUser', password='tH1$isA7357')

        response = self.delete(table.id)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Table.objects.count(), 1)

    def test_deleting_table_returns_204_and_deletes_table_for_users_with_permissions(self):
        table = Table.objects.create(name='Test')

        self.client.login(username='DeleteUser', password='tH1$isA7357')

        response = self.delete(table.id)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Table.objects.count(), 0)

        table = Table.objects.create(name='Test')

        self.client.login(username='AdminUser', password='tH1$isA7357')

        response = self.delete(table.id)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Table.objects.count(), 0)

    def test_editing_table_returns_200_succeeds_for_admin_and_user_with_permissions(self):
        table = Table.objects.create(name='Test')

        self.client.login(username='AdminUser', password='tH1$isA7357')

        response = self.patch({'name': 'Edited'}, table.id)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Table.objects.get(name='Edited'))

        self.client.logout()

        self.client.login(username='UpdateUser', password='tH1$isA7357')

        response = self.patch({'name': 'Edited Again'}, table.id)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Table.objects.get(name='Edited Again'))

    def test_successfully_updating_table_returns_table_object(self):
        table = Table.objects.create(name='Test')

        self.client.login(username='AdminUser', password='tH1$isA7357')

        response = self.patch({'name': 'Edited'}, table.id)
        self.assertEqual(response.json()['name'], 'Edited')
        self.assertTrue(response.json()['id'], table.id)
        self.assertTrue(response.json()['url'], table.url)

    def test_updating_table_with_invalid_data_returns_400_with_error(self):
        table = Table.objects.create(name='Test')

        invalid_data = [
            {},
            {'name': ''},
            {'not_a_name': 'Not a name'},
        ]

        self.client.login(username='AdminUser', password='tH1$isA7357')

        for data in invalid_data:
            response = self.patch(data, table.id)
            self.assertEqual(response.status_code, 400)
            self.assertTrue('error' in response.json())
            self.assertEqual(Table.objects.get(pk=table.id).name, 'Test')
