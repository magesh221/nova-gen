
module.exports = {
  apps: [
    {
      name: 'nova-ai-api',
      cwd: __dirname,
      script: './server.js',
      interpreter: process.execPath,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
