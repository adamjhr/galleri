from flask import Flask, send_from_directory
from dotenv import load_dotenv
import os

load_dotenv()


def create_app():
    app = Flask(__name__, static_folder="static", static_url_path="")
    app.config.from_object("app.config.Config")

    from app import db
    db.init_app(app)

    from app.routes import auth, images
    app.register_blueprint(auth.bp)
    app.register_blueprint(images.bp)

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/<path:path>")
    def static_files(path):
        full = os.path.join(app.static_folder, path)
        if os.path.isfile(full):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")

    return app
