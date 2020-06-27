from django.forms import ModelForm
from visitors.models import Visitor


class VisitorForm(ModelForm):
    class Meta:
        model = Visitor
        exclude = ('group',)
