# Generated by Django 3.0.7 on 2020-06-29 15:39

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='section',
            name='parent_section',
        ),
        migrations.AlterField(
            model_name='item',
            name='section',
            field=models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_NULL, to='menu.Section'),
        ),
    ]
