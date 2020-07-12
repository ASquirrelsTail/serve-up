from django.db import models
from django.db.models.signals import post_save, pre_delete
import os
import qrcode
from uuid import uuid4
from serveup.settings import IP, PORT, STATIC_ROOT, STATIC_URL


def createUUID():
    return uuid4().hex


class Table(models.Model):
    name = models.CharField(max_length=50, null=False, blank=False, unique=True)
    uuid = models.CharField(max_length=32, default=createUUID, null=False, blank=False, unique=True)

    def __str__(self):
        return 'Table {}'.format(self.name)

    @property
    def img(self):
        return '{}qrcodes/{}.png'.format(STATIC_URL, self.uuid)

    @classmethod
    def post_create(cls, sender, instance, created, *args, **kwargs):
        if created:
            path = os.path.join(STATIC_ROOT[0], 'qrcodes', '{}.png'.format(instance.uuid))
            qrcode.make(instance.url).save(path, 'PNG')

    @classmethod
    def pre_delete(cls, sender, instance, *args, **kwargs):
        path = os.path.join(STATIC_ROOT[0], 'qrcodes', '{}.png'.format(instance.uuid))
        if os.path.exists(path):
            os.remove(path)

    @property
    def url(self):
        return 'http://{}:{}/{}/'.format(IP, PORT, self.uuid)


post_save.connect(Table.post_create, sender=Table)
pre_delete.connect(Table.pre_delete, sender=Table)
