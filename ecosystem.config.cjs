module.exports = {
  apps: [
    {
      name: "studytogether-api",
      script: "./server/server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./server/logs/pm2-error.log",
      out_file: "./server/logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      combine_logs: true,
      merge_logs: true,
    },
    {
      name: "studytogether-ai",
      script: "./ai/server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1.5G",
      env_production: {
        NODE_ENV: "production",
        AI_PORT: 5001,
      },
      error_file: "./ai/logs/pm2-error.log",
      out_file: "./ai/logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      combine_logs: true,
      merge_logs: true,
    },
  ],
};
