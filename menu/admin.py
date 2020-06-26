from django.contrib import admin
from menu.models import Item, Section


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    exclude = ('order',)


class ItemInline(admin.TabularInline):
    model = Item
    exclude = ('order',)
    extra = 1


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    exclude = ('order',)
    inlines = (ItemInline,)
