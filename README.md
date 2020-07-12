# Serve Up

Serve Up is an order from table web app that you can run locally over your wifi so customers can place orders from their mobile phone. Simple and easy to set up, Serve Up allows you to take orders, and for you employees to review and complete them from their own mobile devices.

Customers register their details for the purpose of contact tracing, which are stored securely on your computer, rather than with a third party, so you keep control of customer data and GDPR compliance is a lot simpler.

Serve up is a free alternative to commercial cloud based order from table apps, aimed to help small cafes and restaurants during the coronavirus pandemic.


## Features

- QR Codes generated for each table, so customers simply log on to your wifi and scan the code to begin.
- Groups register their details to be shared with NHS Track and Trace if necessary.
- A simple web app lets customers browse the menu and place their order from their table.
- A dashboard for employees allows them to manage orders, tables and alter the menu from their mobile device or a computer.

## Technologies Used

- Django
- Svelte.js

## Deployment

Serve Up requires Python3, so ensure that is already installed. Download or clone the repository, navigate to the base directory and then install the required modules:

```
$ pip install -r requirements.txt
```

Launch the wsgi server by running serveup.py. This will automatically do any first time set up, and open the admin interface.

```
& python3 serveup.py
```

From there you can add additional users and access the dashboard.
