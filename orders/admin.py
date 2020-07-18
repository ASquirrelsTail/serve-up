from django.contrib import admin
from orders.models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    readonly_fields = ('total', 'vat_total')
    extra = 1


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    fields = ('group', 'total', 'staff_member', 'completed', 'paid', 'time')
    readonly_fields = ('total', 'time', 'group')
    inlines = (OrderItemInline,)

    def total(self, obj):
        return '£{:.2f}'.format(obj.total)
