import qrcode
import qrcode.image.svg

from io import BytesIO

from django.contrib import admin
from django.utils.safestring import mark_safe
from tables.models import Table


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    readonly_fields = ('uuid', 'url', 'qr_code')

    def qr_code(self, obj):
        svg = BytesIO()
        qrcode.make(obj.url, image_factory=qrcode.image.svg.SvgPathImage).save(svg)
        return mark_safe(svg.getvalue().decode('utf-8'))
