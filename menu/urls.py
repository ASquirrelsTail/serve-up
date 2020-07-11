from django.urls import path
from menu.views import MenuView, MenuItemsView, MenuSectionsView, MenuItemEditView, MenuSectionEditView

urlpatterns = [
    path('', MenuView.as_view(), name='menu'),
    path('sections/', MenuSectionsView.as_view(), name='sections'),
    path('sections/<int:pk>/', MenuSectionEditView.as_view(), name='section-edit'),
    path('items/', MenuItemsView.as_view(), name='items'),
    path('items/<int:pk>/', MenuItemEditView.as_view(), name='item-edit'),
]