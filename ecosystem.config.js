module.exports = {
  apps: [
    {
      name: "privy-export",
      script: "npm",
      args: "start",
      autorestart: false,
      env: {
        NODE_ENV: "production",
        FETCH_NEW_ONLY: "true",
        UNIQUE_FILES: "true",
      },
    },
  ],
};
