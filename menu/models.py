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
    parent_section = models.ForeignKey('self', null=True, blank=True, default=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.name

    def serialize(self, logged_in=False):
        if logged_in:
            items = list(self.item_set.values('id', 'name', 'description', 'price', 'vat', 'order', 'visible'))
            sections = [section.serialize(logged_in) for section in self.section_set.all()]
        else:
            items = list(self.item_set.exclude(visible=False).values('id', 'name', 'description', 'price', 'vat', 'order'))
            sections = [section.serialize(logged_in) for section in self.section_set.exclude(visible=False)]

        result = {'id': self.id,
                  'name': self.name,
                  'description': self.description,
                  'order': self.order,
                  'items': items + sections}

        if logged_in:
            result['visible'] = self.visible

        return result
