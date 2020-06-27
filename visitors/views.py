from django.views import View
from django.http import JsonResponse
from django.contrib.auth.mixins import AccessMixin
from django.utils import timezone
from datetime import timedelta
import json
from http import HTTPStatus

from visitors.forms import VisitorForm
from visitors.models import Group
from tables.views import TableMixin


class HasGroupMixin(AccessMixin):
    permission_denied_message = 'Visitor information required before this action can be carried out.'
    raise_exception = True

    def dispatch(self, request, *args, **kwargs):
        if 'group' not in request.session:
            return self.handle_no_permission()

        try:
            group = Group.objects.get(pk=request.session['group'])
        except Group.DoesNotExist:
            return self.handle_no_permission()

        if group.time < timezone.now() - timedelta(hours=2):
            return self.handle_no_permission()
        return super(HasGroupMixin, self).dispatch(request, *args, **kwargs)


class CreateGroup(TableMixin, View):
    def get(self, request, **kawrgs):
        return JsonResponse({'table': self.get_object().id})

    def post(self, request, **kwargs):
        '''
        Validates submitted visitor info and creates a group registering their visit in the database.
        Adds group id to the session.
        '''
        data = json.loads(request.body)

        if 'visitors' not in data:
            return JsonResponse({'error': 'Please enter details for at least one visitor!'},
                                status=HTTPStatus.BAD_REQUEST)

        visitors = [VisitorForm(visitor) for visitor in data['visitors']]

        # Validate each visitor and check at least one has contact details
        valid = True
        contact_details = False
        for visitor_form in visitors:
            if visitor_form.is_valid():
                if visitor_form.cleaned_data['email'] or visitor_form.cleaned_data['phone_number']:
                    contact_details = True
            else:
                valid = False

        valid = valid * contact_details

        if not valid:
            response_data = {'error': 'Please correct errors with visitor details',
                             'form_errors': [visitor_form.errors for visitor_form in visitors]}
            if not contact_details:
                response_data['error'] = 'Contact details are required for at least one member of the group.'

            return JsonResponse(response_data, status=HTTPStatus.BAD_REQUEST)

        # Create group and save each visitor to it

        group = Group.objects.create(table=self.get_object())

        for visitor_form in visitors:
            visitor = visitor_form.save(commit=False)
            visitor.group = group
            visitor.save()

        # Add the group id to the session

        request.session['group'] = group.id
        request.session.set_expiry(7200)  # Group session will persist for 2 hours from last interaction

        return JsonResponse({}, status=HTTPStatus.NO_CONTENT)
