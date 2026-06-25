  module.exports = {
    apps: [
      {
        name: "attendance-sync",
        cwd: __dirname,
        script: "scripts/run-mssql-attendance-sync-agent.js",
        interpreter: "node",
        exec_mode: "fork",
        autorestart: true,
        restart_delay: 5000,
        watch: false,
        time: true
      }
    ]
  };
