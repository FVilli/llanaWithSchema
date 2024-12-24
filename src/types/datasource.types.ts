import { SortCondition } from './schema.types'

export enum DataSourceType {
	MYSQL = 'mysql',
	POSTGRES = 'postgres',
	MONGODB = 'mongodb',
	MSSQL = 'mssql',
	AIRTABLE = 'airtable',
}

export enum DataSourceNaming {
	snake_case = 'snake_case',
	camelCase = 'camelCase',
}

export enum QueryPerform {
	CREATE = 'create',
	FIND_ONE = 'find',
	FIND_MANY = 'findMany',
	UPDATE = 'update',
	DELETE = 'delete',
	UNIQUE = 'unique',
	TRUNCATE = 'truncate',
	CREATE_TABLE = 'createTable',
	CHECK_CONNECTION = 'checkConnection',
	LIST_TABLES = 'listTables',
	LIST_VIEWS = 'listViews',
	//DEFAULT_SCHEMA = 'defaultSchema',
}

export enum PublishType {
	INSERT = 'INSERT',
	UPDATE = 'UPDATE',
	DELETE = 'DELETE',
}

export enum WhereOperator {
	equals = '=',
	not_equals = '!=',
	lt = '<',
	lte = '<=',
	gt = '>',
	gte = '>=',
	like = 'LIKE',
	not_like = 'NOT LIKE',
	in = 'IN',
	not_in = 'NOT IN',
	null = 'IS NULL',
	not_null = 'IS NOT NULL',
	search = 'SEARCH',
}

export enum DataSourceColumnType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	DATE = 'date',
	JSON = 'json',
	ENUM = 'enum',
	UNKNOWN = 'unknown',
}

export enum ImportMode {
	CREATE = 'CREATE',
	UPSERT = 'UPSERT',
	DELETE = 'DELETE',
	REPOPULATE = 'REPOPULATE',
}

export declare enum ChartsPeriod {
	MIN = 'MIN',
	'15MIN' = '15MIN',
	'30MIN' = '30MIN',
	HOUR = 'HOUR',
	DAY = 'DAY',
	WEEK = 'WEEK',
	MONTH = 'MONTH',
	YEAR = 'YEAR',
}

export enum DataSourceoinType {
	INNER = 'INNER JOIN',
	LEFT = 'LEFT JOIN',
	RIGHT = 'RIGHT JOIN',
}

export enum DataSourceJoinStage {
	WITH_QUERY = 'WITH_QUERY',
	POST_QUERY = 'POST_QUERY',
}

export interface ChartResult {
	count: number
	[key: string]: any
	time_interval: Date
}

export interface DataSourceDefinition {
	table: string
	schema: string
	primary_key: string
	columns: DataSourceSchemaColumn[]
	relations?: DataSourceSchemaRelation[]
	_x_request_id?: string
}

export interface DataSourceWhere {
	column: string
	operator: WhereOperator
	value?: any
}

export interface ColumnExtraNumber {
	decimal: number // Number of decimal places
}

export interface DataSourceSchemaColumn {
	field: string
	type: DataSourceColumnType
	nullable: boolean
	required: boolean
	primary_key: boolean
	unique_key: boolean
	foreign_key: boolean
	auto_increment?: boolean
	default?: any
	extra?: any | ColumnExtraNumber
	enums?: string[]
}

export interface DataSourceSchemaRelation {
	table: string
	schema: string
	column: string
	org_table: string
	org_column: string
}

export interface DataSourceCreateOneOptions {
	definition: DataSourceDefinition
	data: object
}

export interface DataSourceJoin extends DataSourceSchemaRelation {
	type?: DataSourceoinType
}

export interface DataSourceRelations {
	table: string
	join: DataSourceJoin
	columns?: string[]
	where?: DataSourceWhere
	definition: DataSourceDefinition
}

export interface DataSourceFindOneOptions extends DataSourceFindOptions {}

export interface DataSourceFindManyOptions extends DataSourceFindOptions {
	limit?: number
	offset?: number
	sort?: SortCondition[]
}

export interface DataSourceFindOptions {
	definition: DataSourceDefinition
	fields?: string[]
	where?: DataSourceWhere[]
	relations?: DataSourceRelations[]
}

export interface DataSourceUpdateOneOptions {
	id: string
	definition: DataSourceDefinition
	data: object
}

export interface DataSourceDeleteOneOptions {
	id: string
	definition: DataSourceDefinition
	softDelete?: string // Soft delete column
}

export interface DataSourceFindTotalRecords {
	definition: DataSourceDefinition
	where?: DataSourceWhere[]
}

export interface DataSourceConfig {
	type: DataSourceType
	host: string
	defaults: {
		limit: number
		relations: {
			limit: number
		}
	}
	deletes: {
		soft: string | undefined
	}
}

export interface DataSourceUniqueCheckOptions {
	definition: DataSourceDefinition
	data: {
		[key: string]: string | number | boolean
	}
	id?: string
	x_request_id?: string
}

export interface DataSourceListTablesOptions {
	include_system?: boolean // tables like _llana_*
	include_known_db_orchestration?: boolean // like atlas_schema_revisions
}

export interface DataSourceInterface {
	createTable(schema: DataSourceDefinition): Promise<void>
	findOne(options: DataSourceFindOneOptions): Promise<any>
	findMany(options: DataSourceFindManyOptions): Promise<any[]>
	createOne(options: DataSourceCreateOneOptions): Promise<any>
	updateOne(options: DataSourceUpdateOneOptions): Promise<any>
	deleteOne(options: DataSourceDeleteOneOptions): Promise<void>
	uniqueCheck(options: DataSourceUniqueCheckOptions): Promise<boolean>
	truncate(schema: DataSourceDefinition): Promise<void>
	checkConnection(): Promise<boolean>
	listTables(): Promise<string[]>
}
