from django.urls import reverse
from django.test import TestCase
from tables.models import Table
from visitors.models import Group


class CreateGroupViewTestCase(TestCase):
    '''
    Class to test the Group view for creating a new group
    '''

    @classmethod
    def setUpTestData(cls):
        table = Table.objects.create(name='Test')
        cls.url = reverse('group', kwargs={'slug': table.uuid})

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
