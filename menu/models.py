from django.db import models
from django.db.models.signals import post_save
from datetime import date


class MenuModel(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=1)
    visible = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ('order',)

    def swap_position(self, target):
        if target:
            new_order = target.order

            target.order = self.order
            target.save()

            self.order = new_order
            self.save()
            return True
        else:
            return False

    def move_up(self, queryset=False):
        return self.swap_position(self.__class__.objects.filter(order__lt=self.order).last())

    def move_down(self, queryset=False):
        return self.swap_position(self.__class__.objects.filter(order__gt=self.order).first())


class Item(MenuModel):
    VAT_CHOICES = [(0, '0%'), (0.2, '20%')] if date.today() > date(2021, 1, 12) else [(0, '0%'), (0.2, '20%'), (0.05, '5%')]

    price = models.DecimalField(default=0.00, max_digits=5, decimal_places=2, help_text='Including VAT if applicable.')
    vat = models.FloatField(default=0, choices=VAT_CHOICES)
    section = models.ForeignKey('menu.Section', null=True, blank=True, default=None, on_delete=models.SET_NULL)

    def __str__(self):
        return '{} - £{:.2f}'.format(self.name, self.price)

    @classmethod
    def post_create(cls, sender, instance, created, *args, **kwargs):
        if created and instance.section and instance.section.item_set.count() > 1:
            instance.order = instance.section.item_set.exclude(id=instance.id).last().order + 1
            instance.save()

    def move_up(self):
        if not self.section:
            return False
        else:
            return self.swap_position(self.section.item_set.filter(order__lt=self.order).last())

    def move_down(self):
        if not self.section:
            return False
        else:
            return self.swap_position(self.section.item_set.filter(order__gt=self.order).first())


post_save.connect(Item.post_create, sender=Item)


class Section(MenuModel):

    def __str__(self):
        return self.name

    def serialize(self, show_hidden=False):
        if not show_hidden:
            items = self.item_set.filter(visible=True).values('id', 'name', 'description', 'price', 'vat', 'order')
        else:
            items = self.item_set.values('id', 'name', 'description', 'price', 'vat', 'order', 'visible')

        result = {'id': self.id,
                  'name': self.name,
                  'description': self.description,
                  'order': self.order,
                  'items': list(items)}

        if show_hidden:
            result['visible'] = self.visible

        return result

    @classmethod
    def post_create(cls, sender, instance, created, *args, **kwargs):
        if created and sender.objects.count() > 1:
            instance.order = sender.objects.exclude(id=instance.id).last().order + 1
            instance.save()


post_save.connect(Section.post_create, sender=Section)
