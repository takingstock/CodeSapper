# config.py

# API URL configurations
FLASK_BASE_URL = 'http://0.0.0.0:5200/'
DB_INSERT_URL = FLASK_BASE_URL + 'dbInsert'
DB_SEARCH_URL = FLASK_BASE_URL + 'dbSearch'
DB_UPDATE_URL = FLASK_BASE_URL + 'dbUpdate'

# Another service base URL
ANOTHER_SERVICE_BASE_URL = 'http://api.otherservice.com/'
ANOTHER_SERVICE_LOGIN_URL = ANOTHER_SERVICE_BASE_URL + 'login'
ANOTHER_SERVICE_FETCH_DATA_URL = ANOTHER_SERVICE_BASE_URL + 'fetchData'
ANOTHER_SERVICE_UPDATE_DATA_URL = ANOTHER_SERVICE_BASE_URL + 'updateData'

# Timeout settings for API requests (in seconds)
API_REQUEST_TIMEOUT = 240

# Logging configuration
LOGGING_CONFIG = {
    'version': 1,
    'formatters': {
        'default': {
            'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'app.log',
            'formatter': 'default',
        },
    },
    'root': {
        'level': 'INFO',
        'handlers': ['console', 'file'],
    },
}

# Database configuration
DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'db_user',
    'password': 'db_password',
    'database': 'my_database',
}

# Email service configuration
EMAIL_CONFIG = {
    'smtp_server': 'smtp.gmail.com',
    'smtp_port': 587,
    'smtp_user': 'your_email@gmail.com',
    'smtp_password': 'your_password',
    'from_email': 'your_email@gmail.com',
    'to_emails': ['recipient1@example.com', 'recipient2@example.com'],
}

# Feature toggles
FEATURE_TOGGLES = {
    'enable_feature_x': True,
    'enable_feature_y': False,
}

# Miscellaneous settings
APP_NAME = 'My Awesome Application'
APP_VERSION = '1.0.0'
DEBUG_MODE = True


