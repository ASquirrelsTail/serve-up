from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.views.generic.base import View


class TokenLoginView(View):
    used = False

    def get(self, request, *args, **kwargs):
        if kwargs['slug'] != settings.ADMIN_TOKEN or self.used is True:
            raise PermissionDenied

        user = get_object_or_404(User, username='Admin')
        login(request, user)
        self.__class__.used = True

        return redirect('admin:index')
