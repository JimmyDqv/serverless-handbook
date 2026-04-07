"""Seed example guests for testing.

Usage:
    python seed_data.py --uri "mongodb+srv://cluster.mongodb.net" --db "event-platform"
"""

import argparse
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient


EXAMPLE_GUESTS = [
    {"firstName": "Alice", "lastName": "Admin", "token": "admin001", "isAdmin": True, "expectedGuests": 1, "groupId": None},
    {"firstName": "John", "lastName": "Doe", "token": "john0001", "isAdmin": False, "expectedGuests": 1, "groupId": "doe-family"},
    {"firstName": "Jane", "lastName": "Doe", "token": "jane0001", "isAdmin": False, "expectedGuests": 1, "groupId": "doe-family"},
    {"firstName": "Bob", "lastName": "Smith", "token": "bob00001", "isAdmin": False, "expectedGuests": 2, "groupId": None},
]


def seed(uri: str, db_name: str) -> None:
    client = MongoClient(uri)
    db = client[db_name]
    guests = db["guests"]
    settings = db["settings"]

    now = datetime.now(timezone.utc).isoformat()

    for g in EXAMPLE_GUESTS:
        doc = {
            "_id": str(uuid.uuid4()),
            "firstName": g["firstName"],
            "lastName": g["lastName"],
            "token": g["token"],
            "status": "pending",
            "numGuests": 0,
            "dietary": "",
            "isAdmin": g["isAdmin"],
            "expectedGuests": g["expectedGuests"],
            "groupId": g["groupId"],
            "rsvpDate": None,
            "lastLogin": None,
            "lastAccess": None,
            "createdAt": now,
        }
        guests.insert_one(doc)
        print(f"  Added {g['firstName']} {g['lastName']} (token: {g['token']})")

    settings.update_one(
        {"_id": "app-settings"},
        {"$set": {"rsvpDeadline": "2026-06-20"}},
        upsert=True,
    )
    print("  Set RSVP deadline: 2026-06-20")

    print(f"\nSeeded {len(EXAMPLE_GUESTS)} guests")
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed example guests")
    parser.add_argument("--uri", required=True, help="MongoDB connection URI")
    parser.add_argument("--db", default="event-platform", help="Database name")
    args = parser.parse_args()
    seed(args.uri, args.db)
