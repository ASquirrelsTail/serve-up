from django.db import models
from uuid import uuid4
from serveup.settings import IP, PORT


def createUUID():
    return uuid4().hex


class Table(models.Model):
    name = models.CharField(max_length=50, null=False, blank=False, unique=True)
    uuid = models.CharField(max_length=32, default=createUUID, null=False, blank=False, unique=True)

    def __str__(self):
        return 'Table {}'.format(self.name)

    @property
    def url(self):
        return 'http://{}:{}/{}/'.format(IP, PORT, self.uuid)
