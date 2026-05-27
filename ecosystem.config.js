module.exports = {
  apps: [
    {
      name: "mint-web",
      script: "node_modules/.bin/next",
      args: "start",
      instances: "max",         // Use all CPU cores
      exec_mode: "cluster",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
      // Graceful shutdown
      kill_timeout: 10000,       // 10s grace period
      listen_timeout: 8000,
      wait_ready: true,
      // Restart policies
      max_memory_restart: "1G",
      max_restarts: 10,
      restart_delay: 1000,
      // Logging
      error_file: "./logs/mint-web-error.log",
      out_file: "./logs/mint-web-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
    {
      name: "mint-ws",
      script: "node_modules/.bin/tsx",
      args: "server/websocket.ts",
      instances: 2,              // 2 WS instances (scaled via Redis adapter)
      exec_mode: "cluster",
      env: {
        WEBSOCKET_PORT: 3002,
        NODE_ENV: "production",
      },
      // WS needs longer drain time for active connections
      kill_timeout: 15000,
      listen_timeout: 8000,
      wait_ready: true,
      max_memory_restart: "512M",
      max_restarts: 10,
      restart_delay: 2000,
      error_file: "./logs/mint-ws-error.log",
      out_file: "./logs/mint-ws-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
