import re


def handler(event, context):
    request = event["Records"][0]["cf"]["request"]
    uri = request["uri"]
    uri = re.sub(r"/$", "/index.html", uri)
    request["uri"] = uri
    return request
