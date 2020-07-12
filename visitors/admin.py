from django.contrib import admin
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.utils.html import escape
from visitors.models import Visitor, Group


class VisitorInline(admin.TabularInline):
    model = Visitor
    readonly_fields = ('visitor_name', 'phone_number', 'email')
    exclude = ('name',)
    extra = 0

    def visitor_name(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse("admin:visitors_visitor_change", args=(obj.pk,)), escape(obj)))

    def has_change_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class VisitorAdmin(admin.ModelAdmin):
    readonly_fields = ('visitor_group',)
    exclude = ('group',)
    search_fields = ('name', 'email')

    def visitor_group(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse("admin:visitors_group_change", args=(obj.group.pk,)), escape(obj.group)))
    visitor_group.short_description = 'Group'

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class GroupAdmin(admin.ModelAdmin):
    readonly_fields = ('table', 'time')
    inlines = (VisitorInline,)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(Visitor, VisitorAdmin)
admin.site.register(Group, GroupAdmin)
