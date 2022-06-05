# config definition

| key                           | default   | description                                     |
|-------------------------------|-----------|-------------------------------------------------|
| port                          | 3000      | port number                                     |
| cluster                       | 1         | number of workers                               |
| auth.expires_in.access_token  | 1h        | available duration of access token              |
| auth.expires_in.refresh_token | 365d      | available duration of refresh token             |
| auth.secret.access_token      |           | secret seed for generating access token         |
| auth.secret.refresh_token     |           | secret seed for generating refresh token        |
| mysql.host                    | localhost | MySQL domain                                    |
| mysql.port                    | 3306      | MySQL port                                      |
| mysql.username                |           | MySQL username                                  |
| mysql.password                |           | MySQL password                                  |
| mysql.database                |           | default database to be used                     |
| mysql.rebuild                 | false     | whether to rebuild DB structure on server start |
| mysql.log                     | false     | whether to enable sequelize SQL log             |
| redis.host                    | localhost | Redis host                                      |
| redis.port                    | 6379      | Redis port                                      |
