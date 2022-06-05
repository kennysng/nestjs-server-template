# config definition

| key                           | default   | description                                     |
|-------------------------------|-----------|-------------------------------------------------|
| port                          | 3000      | port number                                     |
| cluster                       | 1         | number of workers                               |
| mysql.host                    | localhost | MySQL domain                                    |
| mysql.port                    | 3306      | MySQL port                                      |
| mysql.username                |           | MySQL username                                  |
| mysql.password                |           | MySQL password                                  |
| mysql.database                |           | default database to be used                     |
| mysql.rebuild                 | false     | whether to rebuild DB structure on server start |
| mysql.log                     | false     | whether to enable sequelize SQL log             |
| redis.host                    | localhost | Redis host                                      |
| redis.port                    | 6379      | Redis port                                      |
