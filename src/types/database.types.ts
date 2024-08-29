import { FindManyOptions } from "typeorm"

export enum DatabaseNaming {
    SNAKE_CASE = "SNAKE_CASE",
    //CAMEL_CASE = "CAMEL_CASE" TODO: support camel case
}

export enum ImportMode {
	CREATE = 'CREATE',
	UPSERT = 'UPSERT',
	DELETE = 'DELETE',
	REPOPULATE = 'REPOPULATE',
}

export declare enum ChartsPeriod {
    MIN = "MIN",
    '15MIN' = "15MIN",
    '30MIN' = "30MIN",
    HOUR = "HOUR",
    DAY = "DAY",
    WEEK = "WEEK",
    MONTH = "MONTH",
    YEAR = "YEAR"
}

export type ChartOptions<T = any> = FindManyOptions<any> & {
	search?: string
	period?: ChartsPeriod
	from?: Date
	to?: Date
}



export interface ChartResult {
	count: number
	[key: string]: any
	time_interval: Date
}

export enum DatabaseType {
    MYSQL = 'mysql',
    POSTGRES = 'postgres',
    MARIADB = 'mariadb',
    SQLITE = 'sqlite',
    MONGODB = 'mongodb',
    CASSANDRA = 'cassandra',
    COUCHBASE = 'couchbase',
    COUCHDB = 'couchdb',
    DYNAMODB = 'dynamodb',
    REDIS = 'redis',
    NEO4J = 'neo4j',
    ELASTICSEARCH = 'elasticsearch',
    INFLUXDB = 'influxdb',
    MSSQL = 'mssql',
    ORACLE = 'oracle'
}

export interface MySQLSchemaObject {
    "Field": string,
    "Type": string,
    "Null": "YES"|"NO",
    "Key": string,
    "Default": null | string,
    "Extra": unknown
}