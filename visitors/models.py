from django.db import models


class Visitor(models.Model):
    name = models.CharField(max_length=100, null=False, blank=False)
    phone_number = models.CharField(max_length=22, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    group = models.ForeignKey('Group', on_delete=models.CASCADE)

    def __str__(self):
        if self.email is None and self.phone_number is None:
            return '{} *'.format(self.name)
        else:
            return self.name


class Group(models.Model):
    table = models.ForeignKey('tables.Table', null=True, on_delete=models.SET_NULL)
    time = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.table:
            return '{} at {:%H:%M %d/%m/%Y}'.format(self.table, self.time)
        else:
            return 'Group at {:%H:%M %d/%m/%Y}'.format(self.table, self.time)
