from django.core.management.base import BaseCommand
from django.utils.timezone import now
from datetime import timedelta
from visitors.models import Visitor


class Command(BaseCommand):
    help = 'Removes visitors older than 21 days from the database'

    def handle(self, *args, **options):
        result = Visitor.objects.filter(group__time__lte=now() - timedelta(days=21)).delete()
        print('Deleted {} visitor records older than 21 days'.format(result[0]))
