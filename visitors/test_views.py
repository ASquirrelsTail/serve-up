from django.urls import reverse
from django.views import View
from django.http import HttpResponse
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import TestCase, RequestFactory
from django.core.exceptions import PermissionDenied
from datetime import timedelta

from tables.models import Table
from orders.models import Order
from visitors.models import Group
from visitors.views import HasGroupMixin


class HasGroupMixinTestCase(TestCase):
    '''
    Class to test HasGroupMixin.
    '''
    @classmethod
    def setUpTestData(cls):
        table = Table.objects.create(name='Test')
        cls.new_group = Group.objects.create(table=table)

        cls.group_with_recent_order = Group.objects.create(table=table)
        cls.group_with_recent_order.time -= timedelta(hours=3)
        cls.group_with_recent_order.save()

        prev_order = Order.objects.create(group=cls.group_with_recent_order)
        prev_order.time -= timedelta(hours=1)
        prev_order.save()

        cls.old_group = Group.objects.create(table=table)
        cls.old_group.time -= timedelta(days=2)
        cls.old_group.save()

        cls.old_group_with_order = Group.objects.create(table=table)
        cls.old_group_with_order.time -= timedelta(hours=5)
        cls.old_group_with_order.save()

        prev_order = Order.objects.create(group=cls.old_group_with_order)
        prev_order.time -= timedelta(hours=3)
        prev_order.save()

    @classmethod
    def tearDownClass(cls):
        Table.objects.all().delete()
        super(HasGroupMixinTestCase, cls).tearDownClass()

    class TestView(HasGroupMixin, View):
        '''
        Simple test class using HasGroupMixin.
        '''

        def get(self, request):
            return HttpResponse('Success')

    def setUp(self):
        self.factory = RequestFactory()

    def test_returns_403_if_group_session_key_is_missing(self):
        request = self.factory.get('')

        middleware = SessionMiddleware()
        middleware.process_request(request)
        request.session.save()

        with self.assertRaises(PermissionDenied):
            self.TestView.as_view()(request)

    def test_returns_403_if_group_is_older_than_2_hours_without_an_order_within_2_hours(self):
        request = self.factory.get('')

        middleware = SessionMiddleware()
        middleware.process_request(request)
        request.session['group'] = self.old_group.id
        request.session.save()

        with self.assertRaises(PermissionDenied):
            self.TestView.as_view()(request)

        request.session['group'] = self.old_group_with_order.id
        request.session.save()

        with self.assertRaises(PermissionDenied):
            self.TestView.as_view()(request)

    def test_returns_OK_if_user_has_valid_group(self):
        request = self.factory.get('')

        middleware = SessionMiddleware()
        middleware.process_request(request)
        request.session['group'] = self.new_group.id
        request.session.save()

        response = self.TestView.as_view()(request)

        self.assertEqual(response.status_code, 200)

        request.session['group'] = self.group_with_recent_order.id
        request.session.save()

        response = self.TestView.as_view()(request)

        self.assertEqual(response.status_code, 200)


class CreateGroupViewTestCase(TestCase):
    '''
    Class to test the Group view for creating a new group
    '''

    @classmethod
    def setUpTestData(cls):
        table = Table.objects.create(name='Test')
        cls.url = reverse('group', kwargs={'slug': table.uuid})

    @classmethod
    def tearDownClass(cls):
        Table.objects.all().delete()
        super(CreateGroupViewTestCase, cls).tearDownClass()

    def setUp(self):
        self.client.session.clear()

    def post(self, data):
        return self.client.post(self.url, data, content_type='application/json')

    def test_returns_400_if_no_data_is_submitted(self):
        '''
        Creating a group should fail if no data submitted, return 400 response, and not create a group or add one to the session.
        '''
        response = self.post({})
        self.assertEqual(response.status_code, 400)
        self.assertTrue('error' in response.json())

        self.assertEqual(Group.objects.count(), 0)
        self.assertFalse('group' in self.client.session)

    def test_returns_400_if_invalid_data_is_submitted(self):
        '''
        Creating a group should fail if invalid data submitted, return 400 response, and not create a group or add one to the session.
        '''
        invalid_data = [
            {'visitors': 'Not a list!'},
            {'visitors': []},
            {'visitors': [{'name': '', 'phone_number': '', 'email': ''}]},
            {'visitors': [{'name': 'John Doe', 'phone_number': '', 'email': 'johndoe.com'}]},
            {'visitors': [{'name': '', 'phone_number': '', 'email': 'john@doe.com'}]},
            {'visitors': [{'name': 'John Doe', 'phone_number': '0161 496 0210', 'email': 'john@doe.com'},
                          {'name': '', 'phone_number': '', 'email': ''}]},
        ]

        for data in invalid_data:
            response = self.post(data)
            self.assertEqual(response.status_code, 400)
            self.assertTrue('error' in response.json())

            self.assertEqual(Group.objects.count(), 0)
            self.assertFalse('group' in self.client.session)

    def test_response_includes_form_errors_if_invalid_data_is_submitted(self):
        '''
        The response should include the form errors for each visitor in the form_errors list
        '''
        response = self.post({'visitors': [{'name': 'John Doe', 'phone_number': '', 'email': 'johndoe.com'}]})
        self.assertTrue('email' in response.json()['form_errors'][0])

        response = self.post({'visitors': [{'name': '', 'phone_number': '', 'email': ''}]})
        self.assertTrue('name' in response.json()['form_errors'][0])

    def test_returns_400_if_none_of_the_submitted_visitors_have_contact_details(self):
        '''
        Creating a group should fail if none o the visitors have any contact details, return 400 response, and not create a group or add one to the session.
        '''
        response = self.post({'visitors': [{'name': 'John Doe', 'phone_number': '', 'email': ''},
                                           {'name': 'Jane Doe', 'phone_number': '', 'email': ''}]})

        self.assertEqual(response.status_code, 400)
        self.assertTrue('error' in response.json())

        self.assertEqual(Group.objects.count(), 0)
        self.assertFalse('group' in self.client.session)

    def test_returns_204_if_group_created_successfully(self):
        '''
        Creating a group should return a 204 response and add the group id to the session if successful.
        '''
        response = self.post({'visitors': [{'name': 'John Doe', 'phone_number': '0161 496 0210', 'email': ''},
                                           {'name': 'Jane Doe', 'phone_number': '', 'email': ''}]})

        self.assertEqual(response.status_code, 204)

        self.assertEqual(Group.objects.count(), 1)
        self.assertTrue('group' in self.client.session)
