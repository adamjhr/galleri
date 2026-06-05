"""
Create the first admin user directly in the database.
Usage: python scripts/seed_admin.py <email> <username> <password>
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(".env.local")

import psycopg2
from app.auth import hash_password
from app.config import Config

if len(sys.argv) != 4:
    print("Usage: seed_admin.py <email> <username> <password>")
    sys.exit(1)

email, username, password = sys.argv[1], sys.argv[2], sys.argv[3]

if len(password) < 8:
    print("Password must be at least 8 characters.")
    sys.exit(1)

conn = psycopg2.connect(
    host=Config.DB_HOST,
    port=Config.DB_PORT,
    dbname=Config.DB_NAME,
    user=Config.DB_USER,
    password=Config.DB_PASSWORD,
)

with conn.cursor() as cur:
    cur.execute("SELECT id FROM users WHERE email = %s OR username = %s", (email, username))
    if cur.fetchone():
        print("Error: a user with that email or username already exists.")
        sys.exit(1)

    cur.execute(
        """
        INSERT INTO users (id, email, username, password_hash, is_admin)
        VALUES (gen_random_uuid(), %s, %s, %s, true)
        """,
        (email, username, hash_password(password)),
    )

conn.commit()
conn.close()
print(f"Admin user '{username}' created.")
