from django.contrib.auth.models import User, Group
from django.db.models.signals import post_save


def set_up_user(sender, instance, created, *args, **kwargs):
    if created:
        instance.is_staff = True
        employees_group = Group.objects.get(name='employees')
        employees_group.user_set.add(instance)
        instance.save()


post_save.connect(set_up_user, sender=User)
