# Generated by Django 3.0.7 on 2020-06-25 17:44

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tables', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='table',
            name='name',
            field=models.CharField(max_length=50, unique=True),
        ),
    ]
