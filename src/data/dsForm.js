/** 注册数据源表单 schema */
import { DS_REGISTER_TYPE_OPTIONS } from '@/data/dsRegisterTypes'

export const DS_COMMON_FIELDS = [
  {
    "n": "name",
    "l": "数据源名称",
    "t": "text",
    "req": 1,
    "ph": "如 ods_trade_mysql",
    "def": ""
  },
  {
    "n": "type",
    "l": "数据源类型",
    "t": "select",
    // 仅已接入/可登记类型；全量别名见 datasources.DS_TYPE_OPTIONS（列表筛选）
    "o": DS_REGISTER_TYPE_OPTIONS,
    "def": "MySQL"
  },
  {
    "n": "purpose",
    "l": "用途",
    "t": "select",
    "o": [
      "数据入湖",
      "仅元数据采集(OM)",
      "出湖目标"
    ],
    "def": "数据入湖"
  },
  {
    "n": "owner",
    "l": "负责人",
    "t": "user-search",
    "req": 1,
    "ph": "搜索姓名 / 账号选择负责人",
    "def": ""
  },
  {
    "n": "desc",
    "l": "用途描述",
    "t": "textarea",
    "ph": "例：交易域核心订单库 CDC 入湖",
    "def": ""
  }
]

export const DS_TYPE_FIELDS = {
  "MySQL": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "10.2.1.8",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "3306"
    },
    {
      "n": "database",
      "l": "数据库名",
      "t": "text",
      "req": 1,
      "ph": "trade",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "trade_reader",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "access",
      "l": "接入方式",
      "t": "select",
      "o": [
        "CDC 实时",
        "CDC 实时 (Canal/Debezium)",
        "批抽取 (DataX)",
        "批抽取 (Spark JDBC)"
      ],
      "def": "CDC 实时"
    },
    {
      "n": "extra",
      "l": "JDBC 高级参数",
      "t": "textarea",
      "ph": "useSSL=false&serverTimezone=Asia/Shanghai",
      "def": ""
    },
    {
      "n": "schema",
      "l": "表清单",
      "t": "textarea",
      "ph": "s_order、s_order_item、s_payment",
      "def": ""
    }
  ],
  "PostgreSQL": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "10.2.2.5",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "5432"
    },
    {
      "n": "database",
      "l": "数据库名",
      "t": "text",
      "req": 1,
      "ph": "user",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "user_reader",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "access",
      "l": "接入方式",
      "t": "select",
      "o": [
        "CDC 实时 (pglogical/Decodable)",
        "批抽取 (DataX)",
        "批抽取 (Spark JDBC)"
      ],
      "def": "CDC 实时 (pglogical/Decodable)"
    },
    {
      "n": "extra",
      "l": "JDBC 高级参数",
      "t": "textarea",
      "ph": "sslmode=require",
      "def": ""
    },
    {
      "n": "schema",
      "l": "Schema.表清单",
      "t": "textarea",
      "ph": "public.user_info, public.user_addr",
      "def": ""
    }
  ],
  "Oracle": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "10.2.3.21",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "1521"
    },
    {
      "n": "sid",
      "l": "SID / 服务名",
      "t": "text",
      "req": 1,
      "ph": "FINCLUB",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "fin_read",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "access",
      "l": "接入方式",
      "t": "select",
      "o": [
        "CDC 实时 (LogMiner/Debezium)",
        "批抽取 (DataX)",
        "批抽取 (Spark JDBC)"
      ],
      "def": "批抽取 (DataX)"
    },
    {
      "n": "extra",
      "l": "JDBC 高级参数",
      "t": "textarea",
      "ph": "oracle.jdbc.OracleDriver",
      "def": ""
    },
    {
      "n": "schema",
      "l": "Schema.表清单",
      "t": "textarea",
      "ph": "ACCOUNT_MAIN, GL_VOUCHER",
      "def": ""
    }
  ],
  "SQL Server": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "10.2.4.8",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "1433"
    },
    {
      "n": "database",
      "l": "数据库名",
      "t": "text",
      "req": 1,
      "ph": "OMSDB",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "oms_reader",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "access",
      "l": "接入方式",
      "t": "select",
      "o": [
        "CDC 实时 (SQL Server CDC)",
        "批抽取 (DataX)",
        "批抽取 (Spark JDBC)"
      ],
      "def": "CDC 实时 (SQL Server CDC)"
    },
    {
      "n": "extra",
      "l": "JDBC 高级参数",
      "t": "textarea",
      "ph": "encrypt=true;trustServerCertificate=true",
      "def": ""
    },
    {
      "n": "schema",
      "l": "Schema.表清单",
      "t": "textarea",
      "ph": "dbo.order、dbo.invoice",
      "def": ""
    }
  ],
  "ClickHouse": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "10.3.2.30",
      "def": ""
    },
    {
      "n": "port",
      "l": "HTTP 端口 (JDBC)",
      "t": "text",
      "req": 1,
      "def": "8123"
    },
    {
      "n": "database",
      "l": "数据库",
      "t": "text",
      "req": 1,
      "ph": "ads",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "default",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "cluster",
      "l": "集群名 (分布式表)",
      "t": "text",
      "ph": "ads_cluster",
      "def": ""
    },
    {
      "n": "shards",
      "l": "分片×副本",
      "t": "text",
      "ph": "3 shard × 2 replica",
      "def": ""
    },
    {
      "n": "schema",
      "l": "表清单",
      "t": "textarea",
      "ph": "ads_gmv_board, ads_user_profile",
      "def": ""
    }
  ],
  "Doris": [
    {
      "n": "host",
      "l": "FE 地址",
      "t": "text",
      "req": 1,
      "ph": "10.3.8.10",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口 (查询)",
      "t": "text",
      "req": 1,
      "def": "9030"
    },
    {
      "n": "database",
      "l": "数据库",
      "t": "text",
      "req": 1,
      "ph": "report",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "report_user",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "feNodes",
      "l": "FE 节点列表",
      "t": "text",
      "ph": "fe1,fe2,fe3:8030",
      "def": ""
    },
    {
      "n": "streamLoad",
      "l": "StreamLoad 接入",
      "t": "select",
      "o": [
        "启用",
        "禁用"
      ],
      "def": "启用"
    },
    {
      "n": "schema",
      "l": "表清单",
      "t": "textarea",
      "ph": "report.*",
      "def": ""
    }
  ],
  "Hive": [
    {
      "n": "host",
      "l": "HiveServer2 地址",
      "t": "text",
      "req": 1,
      "ph": "10.3.1.10",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "10000"
    },
    {
      "n": "database",
      "l": "数据库",
      "t": "text",
      "req": 1,
      "ph": "edw",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "hive",
      "def": ""
    },
    {
      "n": "auth",
      "l": "认证方式",
      "t": "select",
      "o": [
        "Kerberos",
        "LDAP",
        "NONE"
      ],
      "def": "Kerberos"
    },
    {
      "n": "principal",
      "l": "Kerberos Principal",
      "t": "text",
      "ph": "hive/_HOST@CORP.COM",
      "def": ""
    },
    {
      "n": "schema",
      "l": "库.表清单",
      "t": "textarea",
      "ph": "edw.order、edw.user",
      "def": ""
    }
  ],
  "Trino": [
    {
      "n": "host",
      "l": "Coordinator 地址",
      "t": "text",
      "req": 1,
      "ph": "dev3.datagoo.cn",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "8080"
    },
    {
      "n": "catalog",
      "l": "Catalog",
      "t": "text",
      "req": 1,
      "ph": "hive",
      "def": "hive"
    },
    {
      "n": "database",
      "l": "Schema",
      "t": "text",
      "req": 1,
      "ph": "default",
      "def": "default"
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "trino",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "extra",
      "l": "JDBC 高级参数",
      "t": "textarea",
      "ph": "SSL=false",
      "def": ""
    },
    {
      "n": "schema",
      "l": "表清单",
      "t": "textarea",
      "ph": "orders, users",
      "def": ""
    }
  ],
  "Iceberg": [
    {
      "n": "catalogType",
      "l": "Catalog 类型",
      "t": "select",
      "o": [
        "Hive Metastore",
        "REST Catalog",
        "Glue Catalog",
        "Nessie"
      ],
      "def": "Hive Metastore"
    },
    {
      "n": "host",
      "l": "Catalog 地址",
      "t": "text",
      "req": 1,
      "ph": "10.3.3.40",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "9083"
    },
    {
      "n": "warehouse",
      "l": "Warehouse URI",
      "t": "text",
      "req": 1,
      "ph": "s3a://iceberg-warehouse/",
      "def": ""
    },
    {
      "n": "database",
      "l": "默认命名空间",
      "t": "text",
      "ph": "log（Iceberg namespace，非 HMS 库名）",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "hms",
      "def": ""
    },
    {
      "n": "schema",
      "l": "命名空间清单",
      "t": "textarea",
      "ph": "ods_trade, dwd_trade, dws_trade, ads",
      "def": ""
    }
  ],
  "HBase": [
    {
      "n": "zkQuorum",
      "l": "ZK Quorum",
      "t": "text",
      "req": 1,
      "ph": "zk1,zk2,zk3",
      "def": ""
    },
    {
      "n": "port",
      "l": "ZK 端口",
      "t": "text",
      "req": 1,
      "def": "2181"
    },
    {
      "n": "namespace",
      "l": "命名空间",
      "t": "text",
      "req": 1,
      "ph": "ns_tag",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "tag_writer",
      "def": ""
    },
    {
      "n": "auth",
      "l": "认证",
      "t": "select",
      "o": [
        "Kerberos",
        "NONE"
      ],
      "def": "NONE"
    },
    {
      "n": "schema",
      "l": "表族清单",
      "t": "textarea",
      "ph": "user_tags:info, user_tags:ext",
      "def": ""
    }
  ],
  "Kafka": [
    {
      "n": "bootstrap",
      "l": "Bootstrap Servers",
      "t": "text",
      "req": 1,
      "ph": "dev3.datagoo.cn:9562",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "9562"
    },
    {
      "n": "topics",
      "l": "Topic 清单",
      "t": "textarea",
      "req": 1,
      "ph": "app_pv, app_click, app_expose",
      "def": ""
    },
    {
      "n": "security",
      "l": "安全协议",
      "t": "select",
      "o": [
        "PLAINTEXT",
        "SASL_PLAINTEXT",
        "SASL_SSL",
        "SSL"
      ],
      "def": "SASL_SSL"
    },
    {
      "n": "saslMech",
      "l": "SASL 机制",
      "t": "select",
      "o": [
        "PLAIN",
        "SCRAM-SHA-256",
        "SCRAM-SHA-512",
        "GSSAPI"
      ],
      "def": "PLAIN"
    },
    {
      "n": "schemaReg",
      "l": "Schema Registry URL",
      "t": "text",
      "ph": "http://schema-registry:8081",
      "def": ""
    },
    {
      "n": "format",
      "l": "消息格式",
      "t": "select",
      "o": [
        "Avro",
        "JSON",
        "Protobuf",
        "Canal JSON"
      ],
      "def": "Avro"
    }
  ],
  "RabbitMQ": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "10.3.5.60",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口 (AMQP)",
      "t": "text",
      "req": 1,
      "def": "5672"
    },
    {
      "n": "vhost",
      "l": "Virtual Host",
      "t": "text",
      "req": 1,
      "ph": "/event",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "event_user",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "queues",
      "l": "Queue 清单",
      "t": "textarea",
      "ph": "order.create、order.pay",
      "def": ""
    },
    {
      "n": "mgmtPort",
      "l": "管理端口",
      "t": "text",
      "def": "15672"
    }
  ],
  "Pulsar": [
    {
      "n": "serviceUrl",
      "l": "Service URL",
      "t": "text",
      "req": 1,
      "ph": "pulsar://10.3.5.70",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "6650"
    },
    {
      "n": "tenant",
      "l": "Tenant/Namespace",
      "t": "text",
      "req": 1,
      "ph": "public/default",
      "def": ""
    },
    {
      "n": "topics",
      "l": "Topic 清单",
      "t": "textarea",
      "ph": "persistent://public/default/rt-gmv",
      "def": ""
    },
    {
      "n": "auth",
      "l": "认证",
      "t": "select",
      "o": [
        "Token",
        "Athenz",
        "无"
      ],
      "def": "无"
    },
    {
      "n": "format",
      "l": "消息格式",
      "t": "select",
      "o": [
        "Protobuf",
        "Avro",
        "JSON"
      ],
      "def": "Protobuf"
    }
  ],
  "MongoDB": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "10.3.6.20",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "27017"
    },
    {
      "n": "database",
      "l": "数据库",
      "t": "text",
      "req": 1,
      "ph": "behavior_db",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "behavior_read",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "authSource",
      "l": "authSource",
      "t": "text",
      "ph": "admin",
      "def": ""
    },
    {
      "n": "replicaSet",
      "l": "副本集名",
      "t": "text",
      "ph": "mongoRs0",
      "def": ""
    },
    {
      "n": "schema",
      "l": "集合清单",
      "t": "textarea",
      "ph": "behavior.user_action",
      "def": ""
    }
  ],
  "Elasticsearch": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "es1.corp 或 es1:9200（单节点）",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "9200"
    },
    {
      "n": "nodes",
      "l": "集群节点",
      "t": "textarea",
      "ph": "多节点逗号分隔，如 es1:9200,es2:9200,es3:9200（优先于单 host）",
      "def": ""
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "elastic",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "ssl",
      "l": "SSL/TLS",
      "t": "select",
      "o": [
        "启用",
        "禁用"
      ],
      "def": "启用"
    },
    {
      "n": "apiKeyId",
      "l": "API Key Id",
      "t": "text",
      "ph": "abc123",
      "def": ""
    },
    {
      "n": "schema",
      "l": "Index 清单",
      "t": "textarea",
      "ph": "search_user, search_goods",
      "def": ""
    }
  ],
  "Redis": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "单机/入口；Sentinel 可写 sentinel1,sentinel2",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "6379"
    },
    {
      "n": "db",
      "l": "DB Index",
      "t": "text",
      "def": "0"
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "mode",
      "l": "部署模式",
      "t": "select",
      "o": [
        "Standalone",
        "Sentinel",
        "Cluster"
      ],
      "def": "Standalone"
    },
    {
      "n": "masterName",
      "l": "Sentinel Master 名",
      "t": "text",
      "ph": "mymaster（Sentinel 必填）",
      "def": ""
    },
    {
      "n": "nodes",
      "l": "Cluster/Sentinel 节点",
      "t": "textarea",
      "ph": "host:port 逗号分隔，如 10.0.1.1:6379,10.0.1.2:6379（Cluster）或 :26379（Sentinel）",
      "def": ""
    },
    {
      "n": "schema",
      "l": "Key 前缀清单",
      "t": "textarea",
      "ph": "dim_goods:*, dim_user:*",
      "def": ""
    }
  ],
  "HDFS": [
    {
      "n": "nameNode",
      "l": "NameNode 地址",
      "t": "text",
      "req": 1,
      "ph": "10.3.7.20",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "8020"
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "hdfs",
      "def": ""
    },
    {
      "n": "ha",
      "l": "HA nameservice",
      "t": "text",
      "ph": "nameservice1",
      "def": ""
    },
    {
      "n": "auth",
      "l": "认证",
      "t": "select",
      "o": [
        "Kerberos",
        "Simple"
      ],
      "def": "Simple"
    },
    {
      "n": "schema",
      "l": "路径清单",
      "t": "textarea",
      "ph": "/data/raw/, /data/archive/",
      "def": ""
    }
  ],
  "S3 / MinIO": [
    {
      "n": "endpoint",
      "l": "Endpoint",
      "t": "text",
      "req": 1,
      "ph": "minio.corp.local",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "443"
    },
    {
      "n": "accessKey",
      "l": "Access Key",
      "t": "text",
      "req": 1,
      "ph": "minio_admin",
      "def": ""
    },
    {
      "n": "secretKey",
      "l": "Secret Key",
      "t": "text",
      "req": 1,
      "ph": "建议 Vault 注入",
      "def": ""
    },
    {
      "n": "region",
      "l": "Region",
      "t": "text",
      "ph": "cn-north-1",
      "def": ""
    },
    {
      "n": "secure",
      "l": "HTTPS",
      "t": "select",
      "o": [
        "启用",
        "禁用"
      ],
      "def": "启用"
    },
    {
      "n": "schema",
      "l": "Bucket 清单",
      "t": "textarea",
      "ph": "iceberg-warehouse, raw-log, export-bucket",
      "def": ""
    }
  ],
  "FTP/SFTP": [
    {
      "n": "host",
      "l": "主机地址",
      "t": "text",
      "req": 1,
      "ph": "sftp.partner.com",
      "def": ""
    },
    {
      "n": "port",
      "l": "端口",
      "t": "text",
      "req": 1,
      "def": "22"
    },
    {
      "n": "protocol",
      "l": "协议",
      "t": "select",
      "o": [
        "SFTP",
        "FTP",
        "FTPS"
      ],
      "def": "SFTP"
    },
    {
      "n": "user",
      "l": "用户名",
      "t": "text",
      "ph": "our_company",
      "def": ""
    },
    {
      "n": "password",
      "l": "密码",
      "t": "text",
      "ph": "与密钥二选一",
      "def": ""
    },
    {
      "n": "privateKey",
      "l": "私钥路径",
      "t": "text",
      "ph": "/keys/partner_rsa",
      "def": ""
    },
    {
      "n": "path",
      "l": "目录",
      "t": "text",
      "ph": "/inbox",
      "def": ""
    },
    {
      "n": "schema",
      "l": "文件清单",
      "t": "textarea",
      "ph": "每日订单 CSV, 对账单 XLSX",
      "def": ""
    }
  ],
  "HTTP API": [
    {
      "n": "baseURL",
      "l": "Base URL",
      "t": "text",
      "req": 1,
      "ph": "https://erp.corp/api/v1/",
      "def": ""
    },
    {
      "n": "authType",
      "l": "鉴权方式",
      "t": "select",
      "o": [
        "Bearer JWT",
        "OAuth2",
        "API Key",
        "HMAC 签名",
        "无"
      ],
      "def": "Bearer JWT"
    },
    {
      "n": "token",
      "l": "Token / API Key",
      "t": "text",
      "ph": "sk.**** (Vault 注入)",
      "def": ""
    },
    {
      "n": "access",
      "l": "接入方式",
      "t": "select",
      "o": [
        "按需请求",
        "定时轮询 · 10min",
        "定时轮询 · 1h",
        "Webhook 推送"
      ],
      "def": "按需请求"
    },
    {
      "n": "openapiSpec",
      "l": "OpenAPI Spec URL",
      "t": "text",
      "ph": "https://erp.corp/openapi.yaml",
      "def": ""
    },
    {
      "n": "schema",
      "l": "接口清单",
      "t": "textarea",
      "ph": "选择方法后填 Path，如 /api/users；多条用顿号/逗号：GET /order、POST /refund",
      "def": ""
    }
  ]
}

/** 仅保留协议兼容 / 有独立 typeCode 的表单借用；未接入别名已从注册下拉移除 */
export const DS_TYPE_FIELD_ALIAS = {
  "MariaDB": "MySQL",
  "AzureSQL": "SQL Server",
  "StarRocks": "Doris",
  "OpenSearch": "Elasticsearch",
  "S3/MinIO": "S3 / MinIO",
  "S3": "S3 / MinIO",
  "MinIO": "S3 / MinIO",
  "REST": "HTTP API",
  "OpenAPI": "HTTP API",
  "Tableau": "HTTP API",
  "Superset": "HTTP API",
  "Airflow": "HTTP API",
}

/** 类型视觉：底色 / 前景色 / 默认端口；图标见 dsTypeIcons + DsTypeIcon */
export const DS_TYPE_META = {
  "MySQL": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "3306"
  },
  "PostgreSQL": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "5432"
  },
  "Oracle": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "1521"
  },
  "SQL Server": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "1433"
  },
  "ClickHouse": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "8123"
  },
  "Trino": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "8080"
  },
  "Doris": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "9030"
  },
  "Hive": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "10000"
  },
  "Iceberg": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "9083"
  },
  "HBase": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "2181"
  },
  "Kafka": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "9092"
  },
  "RabbitMQ": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "5672"
  },
  "Pulsar": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "6650"
  },
  "MongoDB": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "27017"
  },
  "Elasticsearch": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "9200"
  },
  "Redis": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "6379"
  },
  "HDFS": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "8020"
  },
  "S3 / MinIO": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "443"
  },
  "FTP/SFTP": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "22"
  },
  "HTTP API": {
    "bg": "#e6f7ff",
    "color": "#1890ff",
    "port": "443"
  },
  "StarRocks": {
    "bg": "#fff7e6",
    "color": "#d46b08",
    "port": "9030"
  },
  "Tableau": {
    "bg": "#f6ffed",
    "color": "#389e0d",
    "port": "443"
  },
  "Superset": {
    "bg": "#e6fffb",
    "color": "#13c2c2",
    "port": "8088"
  },
  "Airflow": {
    "bg": "#e6fffb",
    "color": "#13c2c2",
    "port": "8080"
  }
}

/** 后端 typeCode → 门户身份展示名（注册下拉 / 编辑回显；勿折叠为字段借用目标） */
const TYPE_CODE_TO_IDENTITY = {
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  postgresql: 'PostgreSQL',
  pg: 'PostgreSQL',
  oracle: 'Oracle',
  sqlserver: 'SQL Server',
  azuresql: 'AzureSQL',
  clickhouse: 'ClickHouse',
  doris: 'Doris',
  starrocks: 'StarRocks',
  hive: 'Hive',
  iceberg: 'Iceberg',
  hbase: 'HBase',
  trino: 'Trino',
  kafka: 'Kafka',
  rabbitmq: 'RabbitMQ',
  pulsar: 'Pulsar',
  mongodb: 'MongoDB',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',
  opensearch: 'OpenSearch',
  hdfs: 'HDFS',
  s3: 'S3 / MinIO',
  minio: 'S3 / MinIO',
  ftp: 'FTP/SFTP',
  sftp: 'FTP/SFTP',
  file: 'FTP/SFTP',
  http_api: 'HTTP API',
  tableau: 'Tableau',
  superset: 'Superset',
  airflow: 'Airflow',
}

/**
 * 类型身份展示名（StarRocks/Tableau 等保持独立；编辑提交用此值，勿落到 Doris/HTTP API）。
 */
export function resolveDsTypeIdentity(type) {
  let key = String(type || '').trim()
  if (!key) return ''
  if (DS_TYPE_FIELDS[key] || DS_TYPE_META[key] || DS_TYPE_FIELD_ALIAS[key]) return key
  const spaced = key.replace(/\//g, ' / ')
  if (DS_TYPE_META[spaced] || DS_TYPE_FIELDS[spaced] || DS_TYPE_FIELD_ALIAS[spaced]) return spaced
  const byCode = TYPE_CODE_TO_IDENTITY[key.toLowerCase()]
  if (byCode) return byCode
  return key
}

/**
 * 表单字段 schema 键（可走 alias：Tableau→HTTP API）。
 * @deprecated 语义易混；新代码用 resolveDsTypeIdentity + resolveDsFormFieldsKey
 */
export function resolveDsTypeLabel(type) {
  return resolveDsFormFieldsKey(type)
}

/** 连接参数区字段定义键 */
export function resolveDsFormFieldsKey(type) {
  const identity = resolveDsTypeIdentity(type)
  if (DS_TYPE_FIELDS[identity]) return identity
  if (DS_TYPE_FIELD_ALIAS[identity]) return DS_TYPE_FIELD_ALIAS[identity]
  if (DS_TYPE_FIELDS[type]) return type
  if (DS_TYPE_FIELD_ALIAS[type]) return DS_TYPE_FIELD_ALIAS[type]
  return identity
}

export function dsTypeFields(type) {
  const label = resolveDsFormFieldsKey(type)
  return DS_TYPE_FIELDS[label] || DS_TYPE_FIELDS[DS_TYPE_FIELD_ALIAS[label]] || []
}

export function dsTypeMeta(type) {
  const identity = resolveDsTypeIdentity(type)
  if (DS_TYPE_META[identity]) return DS_TYPE_META[identity]
  const fieldsKey = resolveDsFormFieldsKey(type)
  return DS_TYPE_META[fieldsKey] || { bg: '#eff6ff', color: '#3b82f6', port: '' }
}
