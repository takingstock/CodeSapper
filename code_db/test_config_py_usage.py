# main.py

import requests
from config import DB_INSERT_URL, API_REQUEST_TIMEOUT, LOGGING_CONFIG, ANOTHER_SERVICE_BASE_URL
import logging
import logging.config

# Configure logging
logging.config.dictConfig(LOGGING_CONFIG)

def insert_data(data):
    try:
        response = requests.post(url=DB_INSERT_URL, data=data, timeout=API_REQUEST_TIMEOUT)
        response.raise_for_status()  # Raise an HTTPError if the response was an error
        return response.json()
    except requests.RequestException as e:
        logging.error(f"Failed to insert data: {e}")
        return None

def random_data(data):
    try:
        response = requests.post(url=ANOTHER_SERVICE_BASE_URL, data=data, timeout=API_REQUEST_TIMEOUT)
        response.raise_for_status()  # Raise an HTTPError if the response was an error
        return response.json()
    except requests.RequestException as e:
        logging.error(f"Failed to insert data: {e}")
        return None

if __name__ == "__main__":
    data = {'key1': 'value1', 'key2': 'value2'}
    result = insert_data(data)
    if result:
        logging.info(f"Data inserted successfully: {result}")
    else:
        logging.error("Data insertion failed.")

