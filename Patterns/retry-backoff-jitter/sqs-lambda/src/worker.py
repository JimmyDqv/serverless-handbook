import json


def handler(event, context):
    print(json.dumps(event))

    # Simulate an error
    raise Exception("Something went wrong")
