"""Create MongoDB collections and indexes for the event platform.

Usage:
    pip install -r requirements.txt
    python setup.py --uri "mongodb+srv://cluster.mongodb.net" --db "event-platform"

Requires a MongoDB user with dbAdmin role on the target database.
"""

import argparse
from pymongo import MongoClient


def setup(uri: str, db_name: str) -> None:
    client = MongoClient(uri)
    db = client[db_name]

    if "guests" not in db.list_collection_names():
        db.create_collection("guests")
        print("Created 'guests' collection")
    else:
        print("'guests' collection already exists")

    if "settings" not in db.list_collection_names():
        db.create_collection("settings")
        print("Created 'settings' collection")
    else:
        print("'settings' collection already exists")

    guests = db["guests"]

    guests.create_index("token", unique=True, name="token_unique")
    print("Created index: token_unique")

    guests.create_index("groupId", sparse=True, name="groupId_sparse")
    print("Created index: groupId_sparse")

    guests.create_index("status", name="status_1")
    print("Created index: status_1")

    guests.create_index([("status", 1), ("dietary", 1)], name="status_dietary")
    print("Created index: status_dietary")

    print("\nSetup complete!")
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up MongoDB for the event platform")
    parser.add_argument("--uri", required=True, help="MongoDB connection URI")
    parser.add_argument("--db", default="event-platform", help="Database name")
    args = parser.parse_args()
    setup(args.uri, args.db)
