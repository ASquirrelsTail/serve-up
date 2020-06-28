from django.forms import ModelForm
from django.forms import ModelChoiceField
from orders.models import OrderItem
from menu.models import Item


class OrderItemForm(ModelForm):
    item = ModelChoiceField(queryset=Item.objects.filter(visible=True))

    class Meta:
        model = OrderItem
        exclude = ('total', 'order',)
