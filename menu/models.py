from django.db import models


class MenuModel(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=1)
    visible = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ('-order',)


class Item(MenuModel):
    price = models.DecimalField(default=0.00, max_digits=5, decimal_places=2, help_text='Including VAT if applicable.')
    vat = models.BooleanField(default=True)
    section = models.ForeignKey('menu.Section', null=True, blank=True, default=None, on_delete=models.SET_NULL)

    def __str__(self):
        return '{} - £{:.2f}'.format(self.name, self.price)


class Section(MenuModel):

    def __str__(self):
        return self.name

    def serialize(self, show_hidden=False):
        if not show_hidden:
            items = self.item_set.filter(visible=True).values('id', 'name', 'description', 'price', 'vat', 'order', 'visible')
        else:
            items = self.item_set.values('id', 'name', 'description', 'price', 'vat', 'order')

        result = {'id': self.id,
                  'name': self.name,
                  'description': self.description,
                  'order': self.order,
                  'items': list(items)}

        if show_hidden:
            result['visible'] = self.visible

        return result
