import os
from distutils.dir_util import copy_tree
# import PyInstaller.__main__

pyinst_args = [
    '-c',
    'serveup.py',
    '--name=ServeUp',
    '--onefile',
    '--hidden-import=whitenoise',
    '--hidden-import=whitenoise.middleware',
    '--hidden-import=visitors.admin',
    '--hidden-import=tables.admin',
    '--hidden-import=orders.admin',
    '--hidden-import=menu.admin',
    '--clean',
]

# PyInstaller.__main__.run(pyinst_args)  # running pyinstaller via this script in windows is super brittle

os.system('pyinstaller {}'.format(' '.join(pyinst_args)))  # Just use the command line instead

dist_static_path = os.path.join('dist', 'static')
if not os.path.exists(dist_static_path):
    os.mkdir(dist_static_path)
copy_tree('static', dist_static_path)
