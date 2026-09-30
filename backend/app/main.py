from flask import Flask
from flask_cors import CORS
import os

def create_app():
    app = Flask(__name__)
    CORS(app) # Enable CORS for all routes

    # Register Blueprints
    from app.routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 3365))
    host = os.environ.get("HOST", "0.0.0.0")
    use_waitress = os.environ.get("USE_WAITRESS", "1") == "1"

    if use_waitress:
        try:
            from waitress import serve
            print(f"Serving Flask backend with Waitress on http://{host}:{port}")
            serve(app, host=host, port=port, threads=6)
        except ImportError:
            print(f"Waitress not installed, falling back to Flask development server on http://{host}:{port}")
            app.run(debug=False, host=host, port=port, use_reloader=False)
    else:
        app.run(debug=True, host=host, port=port, use_reloader=False)
