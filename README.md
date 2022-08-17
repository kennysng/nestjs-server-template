# node-server-template
This is a web server template, supporting following features:
 - HTTP request queue architecture, using [bee-queue](https://github.com/bee-queue/bee-queue) and [fastify](https://github.com/fastify/fastify)
 - Clustering, using [cluster](https://nodejs.org/api/cluster.html)
 - JSON Web Token Authentication, using [@fastiry/jwt](https://github.com/fastify/fastify-jwt)
 - Database, using [sequelize-typescript](https://github.com/sequelize/sequelize-typescript)
 - Health Check

## Why using request queue architecture
---
1. Micro service architecture
  - Downtime of one micro service will not cause the downtime of the whole system.
  - You can easily scale up or down the queue server, or any of the workers when necessary, say with AWS auto-scaling plan.
2. Pull-based HTTP request
  - With multiple workers for a specific queue, this easily archieves multi-tasking.
  - Idle workers will automatically get a task from the queue to work on, saving server resources.
