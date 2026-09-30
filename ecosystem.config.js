module.exports = {
  apps: [
    {
      name: "woundcare-backend",
      cwd: "./backend",
      script: "venv/Scripts/python.exe",
      args: "-m app.main",
      env: {
        PORT: 3365,
        HOST: "127.0.0.1",
        PYTHONUNBUFFERED: "1",
        USE_WAITRESS: "1"
      },
      max_memory_restart: "2G",
      restart_delay: 3000,
      autorestart: true,
      watch: false
    },
    {
      name: "woundcare-frontend",
      cwd: "./frontend",
      script: "server.js",
      env: {
        PORT: 3367,
        BACKEND_URL: "http://127.0.0.1:3365",
        NODE_ENV: "production"
      },
      max_memory_restart: "1G",
      restart_delay: 3000,
      autorestart: true,
      watch: false
    }
  ]
};
