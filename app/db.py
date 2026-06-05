import psycopg2
from psycopg2 import pool
from flask import current_app, g


def get_pool():
    if "db_pool" not in g:
        cfg = current_app.config
        g.db_pool = pool.SimpleConnectionPool(
            1,
            10,
            host=cfg["DB_HOST"],
            port=cfg["DB_PORT"],
            dbname=cfg["DB_NAME"],
            user=cfg["DB_USER"],
            password=cfg["DB_PASSWORD"],
        )
    return g.db_pool


def get_conn():
    if "db_conn" not in g:
        g.db_conn = get_pool().getconn()
    return g.db_conn


def close_conn(e=None):
    conn = g.pop("db_conn", None)
    db_pool = g.pop("db_pool", None)
    if conn is not None and db_pool is not None:
        db_pool.putconn(conn)
    elif db_pool is not None:
        db_pool.closeall()


def init_app(app):
    app.teardown_appcontext(close_conn)
