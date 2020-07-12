import os
import webbrowser
import django
from django.core.management import call_command
from django.conf import settings
from waitress import serve
from serveup import wsgi


def open_site():
    webbrowser.open('http://localhost:{}/admin/token/{}/'.format(8080, settings.ADMIN_TOKEN))


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'serveup.settings')
    django.setup()

    base_dir = os.path.dirname(os.path.abspath(__file__))

    database_exists = os.path.isfile(os.path.join(base_dir, 'db.sqlite3'))

    call_command('migrate', verbosity=0)
    if not database_exists:
        call_command('createsuperuser', '--username', 'Admin', '--email', 'none@none.com', interactive=False, verbosity=0)

    open_site()
    serve(wsgi.application, host='0.0.0.0', port=8080)


if __name__ == '__main__':
    main()
