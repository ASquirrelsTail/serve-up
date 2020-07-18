from unittest import skip
from uuid import uuid4
from django.urls import reverse
from django.test import TestCase
from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command


class AdminTokenViewTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('createsuperuser', '--username', 'Admin', '--email', 'none@none.com', interactive=False, verbosity=0)

        cls.admin_user = User.objects.create_user(username='AdminUser', email='admin@test.com',
                                                  password='tH1$isA7357', is_staff=True)

        cls.other_user = User.objects.create_user(username='OtherUser', email='other@test.com',
                                                  password='tH1$isA7357')

        cls.url = reverse('tables')

    def setUp(self):
        self.client.logout()

    @skip('Can only run test once, rely on next test instead')
    def test_token_view_logs_in_admin(self):
        url = reverse('admin-token', kwargs={'slug': settings.ADMIN_TOKEN})

        response = self.client.get(url)
        self.assertRedirects(response, reverse('admin:index'))
        self.assertEqual(int(self.client.session.get('_auth_user_id')), User.objects.get(username='Admin').id)

    def test_token_only_works_once(self):
        # The token should log a user in as admin and redirect to admin only on first use
        url = reverse('admin-token', kwargs={'slug': settings.ADMIN_TOKEN})

        response = self.client.get(url)
        self.assertRedirects(response, reverse('admin:index'))
        self.assertEqual(int(self.client.session.get('_auth_user_id')), User.objects.get(username='Admin').id)

        self.client.logout()

        response = self.client.get(url)
        self.assertEqual(response.status_code, 403)
        self.assertIsNone(self.client.session.get('_auth_user_id'))

    def test_redirects_to_admin_for_staff_users(self):
        url = reverse('admin-token', kwargs={'slug': settings.ADMIN_TOKEN})

        self.client.force_login(self.admin_user)

        response = self.client.get(url)
        self.assertRedirects(response, reverse('admin:index'))

    def test_invalid_token_returns_forbidden(self):
        url = reverse('admin-token', kwargs={'slug': uuid4().hex})

        response = self.client.get(url)
        self.assertEqual(response.status_code, 403)
        self.assertIsNone(self.client.session.get('_auth_user_id'))
