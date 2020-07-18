"""serveup URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from django.views.generic.base import TemplateView
from visitors.views import GroupView
from orders.views import TableOrderView, DailyOrdersView, DashboardView, OrderView
from tables.views import TablesView, TableEditView
from serve_admin.views import TokenLoginView
from menu.views import MenuView, MenuItemsView, MenuSectionsView, MenuItemEditView, MenuSectionEditView

menu_urls = [
    path('', MenuView.as_view(), name='menu'),
    path('sections/', MenuSectionsView.as_view(), name='sections'),
    path('sections/<int:pk>/', MenuSectionEditView.as_view(), name='section-edit'),
    path('items/', MenuItemsView.as_view(), name='items'),
    path('items/<int:pk>/', MenuItemEditView.as_view(), name='item-edit'),
]

table_urls = [
    path('group/', GroupView.as_view(), name='group'),
    path('order/', TableOrderView.as_view(), name='table-order'),
    path('', TemplateView.as_view(template_name='index.html'), name='table')
]

orders_urls = [
    path('', DailyOrdersView.as_view(), name='orders'),
    path('<int:pk>/', OrderView.as_view(), name='order'),
]

tables_urls = [
    path('', TablesView.as_view(), name='tables'),
    path('<int:pk>/', TableEditView.as_view(), name='table-edit'),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('admin/token/<slug:slug>/', TokenLoginView.as_view(), name='admin-token'),
    path('menu/', include(menu_urls)),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('orders/', include(orders_urls)),
    path('tables/', include(tables_urls)),
    path('<slug:slug>/', include(table_urls)),
]
