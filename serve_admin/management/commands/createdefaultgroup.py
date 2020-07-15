from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission


class Command(BaseCommand):
    help = 'Creates the default user group for employees'

    def handle(self, *args, **options):
        employee_group, created = Group.objects.get_or_create(name='employees')

        permissions = ['menu.view_item',
                       'menu.add_item',
                       'menu.change_item',
                       'menu.delete_item',
                       'menu.view_section',
                       'menu.add_section',
                       'menu.change_section',
                       'menu.delete_section',
                       'tables.view_table',
                       'tables.add_table',
                       'tables.change_table',
                       'tables.delete_table',
                       'orders.view_order',
                       'orders.change_order']

        employee_group.permissions.set([Permission.objects.get(content_type__app_label=permission.split('.')[0], codename=permission.split('.')[1]) for permission in permissions])
