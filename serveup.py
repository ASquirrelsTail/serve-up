import os
import webbrowser
import json
import django
from django.core.management import call_command
from django.core.management.utils import get_random_secret_key
from waitress import serve

base_dir = os.path.dirname(os.path.abspath(__file__))


def open_site():
    from django.conf import settings
    webbrowser.open('http://localhost:{}/admin/token/{}/'.format(8080, settings.ADMIN_TOKEN))


def create_settings_file():
    with open(os.path.join(base_dir, 'settings.json'), 'w') as settings_file:
        json.dump({'secret_key': get_random_secret_key()}, settings_file)


def main():

    database_exists = os.path.isfile(os.path.join(base_dir, 'db.sqlite3'))
    staticfiles_exist = os.path.isdir(os.path.join(base_dir, 'staticfiles'))

    settings_exists = os.path.isfile(os.path.join(base_dir, 'settings.json'))

    if not settings_exists:
        create_settings_file()

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'serveup.settings')
    django.setup()

    call_command('migrate', verbosity=0)
    if not staticfiles_exist:
        call_command('collectstatic', verbosity=0)
    if not database_exists:
        call_command('createsuperuser', '--username', 'Admin', '--email', 'none@none.com', interactive=False, verbosity=0)

    open_site()
    from serveup import wsgi
    serve(wsgi.application, host='0.0.0.0', port=8080)


if __name__ == '__main__':
    main()
