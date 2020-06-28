from django.views.generic.detail import SingleObjectMixin
from tables.models import Table


class TableMixin(SingleObjectMixin):
    model = Table
    slug_field = 'uuid'

    def get_table(self):
        return self.get_object()
