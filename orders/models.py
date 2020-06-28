from django.db import models
from django.core.validators import MinValueValidator


class Order(models.Model):
    completed = models.BooleanField(default=False)
    paid = models.BooleanField(default=False)
    time = models.DateTimeField(auto_now_add=True)
    staff_member = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, default=None, blank=True)
    group = models.ForeignKey('visitors.Group', on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return '{} - {} items - £{:.2f}{}'.format(self.group,
                                                  self.no_items,
                                                  self.total,
                                                  ' - PAID' if self.paid else '')

    @property
    def total(self):
        total = self.orderitem_set.aggregate(models.Sum('total'))['total__sum']
        return total if total else 0

    @property
    def vat_total(self):
        vat_total = self.orderitem_set.filter('item__vat').aggregate(models.Sum('total'))['total__sum'] * 0.2
        return vat_total if vat_total else 0

    @property
    def no_items(self):
        count = self.orderitem_set.aggregate(models.Sum('count'))['count__sum']
        return count if count else 0

    def serialize(self):
        return {'id': self.id,
                'group': str(self.group),
                'completed': self.completed,
                'paid': self.paid,
                'time': self.time,
                'staff_member': self.staff_member.first_name if self.staff_member else '',
                'order_items': [{'id': order_item.id,
                                 'item_id': order_item.item.id,
                                 'item_name': order_item.item.name,
                                 'count': order_item.count,
                                 'total': order_item.total}
                                for order_item in self.orderitem_set.all()]}


class OrderItem(models.Model):
    item = models.ForeignKey('menu.Item', on_delete=models.SET_NULL, null=True, blank=True)
    count = models.PositiveIntegerField(validators=[MinValueValidator(1)], default=1)
    total = models.DecimalField(default=0.00, max_digits=5, decimal_places=2)
    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE)

    def save(self, *args, **kwargs):
        if not self.order.paid and self.item:
            self.total = self.item.price * self.count
        return super(OrderItem, self).save(*args, **kwargs)

    def __str__(self):
        return '{} x {} - £{:.2f}'.format(self.count,
                                          self.item.name if self.item else 'ITEM',
                                          self.total)
