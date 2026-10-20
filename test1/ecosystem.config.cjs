
module.exports = {
  apps: [
    {
      name: 'server',
      script: './server.js',
      watch: '.'
    },
    {
      name: 'service-worker',
      script: './service-worker/service-worker.js',
      watch: ['./service-worker']
    }
  ]
};
