from django.forms import ModelForm
from tables.models import Table


class TableForm(ModelForm):
    class Meta:
        model = Table
        fields = ('name',)
