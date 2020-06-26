# Generated by Django 3.0.7 on 2020-06-26 15:29

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Section',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('order', models.IntegerField(default=1)),
                ('visible', models.BooleanField(default=True)),
                ('parent_section', models.ForeignKey(blank=True, default=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='menu.Section')),
            ],
            options={
                'ordering': ('-order',),
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='Item',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('order', models.IntegerField(default=1)),
                ('visible', models.BooleanField(default=True)),
                ('price', models.DecimalField(decimal_places=2, default=0.0, help_text='Including VAT if applicable.', max_digits=5)),
                ('vat', models.BooleanField(default=True)),
                ('section', models.ForeignKey(blank=True, default=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='menu.Section')),
            ],
            options={
                'ordering': ('-order',),
                'abstract': False,
            },
        ),
    ]
