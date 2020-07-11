from django.forms import ModelForm
from menu.models import Section, Item


class SectionForm(ModelForm):

    class Meta:
        model = Section
        fields = ('name', 'description', 'visible')


class ItemForm(ModelForm):

    class Meta:
        model = Item
        fields = ('name', 'description', 'price', 'vat', 'visible', 'section')
