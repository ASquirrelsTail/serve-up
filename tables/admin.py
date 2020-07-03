from django.contrib import admin
from django.utils.safestring import mark_safe
from tables.models import Table


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    readonly_fields = ('uuid', 'url', 'qr_code')

    def qr_code(self, obj):
        return mark_safe('<img src="{}" alt="" />'.format(obj.img, str(obj)))
