import { Body, Controller, Delete, Headers, Param, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { LLANA_WEBHOOK_TABLE } from './app.constants'
import { HeaderParams } from './dtos/requests.dto'
import { DeleteManyResponseObject, DeleteResponseObject, FindOneResponseObject } from './dtos/response.dto'
import { Authentication } from './helpers/Authentication'
import { UrlToTable } from './helpers/Database'
import { Definition } from './helpers/Definition'
import { Query } from './helpers/Query'
import { Response } from './helpers/Response'
import { Roles } from './helpers/Roles'
import { Webhook } from './helpers/Webhook'
import { WebsocketService } from './modules/websocket/websocket.service'
import { AuthTablePermissionFailResponse, AuthTablePermissionSuccessResponse } from './types/auth.types'
import {
	DataSourceConfig,
	DataSourceDefinition,
	DataSourceWhere,
	PublishType,
	QueryPerform,
	WhereOperator,
} from './types/datasource.types'
import { RolePermission } from './types/roles.types'

@Controller()
export class DeleteController {
	constructor(
		private readonly authentication: Authentication,
		private readonly configService: ConfigService,
		private readonly query: Query,
		private readonly response: Response,
		private readonly roles: Roles,
		private readonly definition: Definition,
		private readonly websocket: WebsocketService,
		private readonly webhook: Webhook,
	) {}

	@Delete('*/:id')
	async deleteById(
		@Req() req,
		@Res() res,
		@Headers() headers: HeaderParams,
		@Param('id') id: string,
	): Promise<DeleteResponseObject> {
		const x_request_id = headers['x-request-id']
		let { schema, tableOrView } = this.query.urlParser(UrlToTable(req.originalUrl, 1))

		if (tableOrView === 'webhook') tableOrView = LLANA_WEBHOOK_TABLE

		let definition: DataSourceDefinition

		try {
			definition = await this.definition.getDefinition(tableOrView, schema, x_request_id)
		} catch (e) {
			return res.status(404).send(this.response.text(e.message))
		}

		const auth = await this.authentication.auth({
			table: tableOrView,
			schema,
			x_request_id,
			access: RolePermission.DELETE,
			headers: req.headers,
			body: req.body,
			query: req.query,
		})
		if (!auth.valid) {
			return res.status(401).send(this.response.text(auth.message))
		}

		//perform role check

		const role_where = []

		if (auth.user_identifier) {
			const permission = await this.roles.tablePermission({
				identifier: auth.user_identifier,
				table: tableOrView,
				access: RolePermission.DELETE,
				x_request_id,
			})

			if (!permission.valid) {
				return res.status(401).send(this.response.text((permission as AuthTablePermissionFailResponse).message))
			}

			if (permission.valid && (permission as AuthTablePermissionSuccessResponse).restriction) {
				role_where.push((permission as AuthTablePermissionSuccessResponse).restriction)
			}
		}

		//validate :id field
		const primary_key = this.definition.getPrimaryKey(definition)

		if (!primary_key) {
			return res.status(400).send(this.response.text(`No primary key found for table ${tableOrView}`))
		}

		const validateKey = await this.definition.validateData(definition, { [primary_key]: id })
		if (!validateKey.valid) {
			return res.status(400).send(this.response.text(validateKey.message))
		}

		const where = <DataSourceWhere[]>[
			{
				column: primary_key,
				operator: WhereOperator.equals,
				value: id,
			},
		]

		if (role_where.length > 0) {
			where.concat(role_where)
		}

		//Check record exists

		const record = (await this.query.perform(
			QueryPerform.FIND_ONE,
			{
				definition,
				where,
			},
			x_request_id,
		)) as FindOneResponseObject

		if (!record) {
			return res.status(400).send(this.response.text(`Record with id ${id} not found`))
		}

		//Soft or Hard delete check
		const databaseConfig: DataSourceConfig = this.configService.get('database')

		let softDelete: string = null

		if (databaseConfig.deletes.soft && definition.columns.find(col => col.field === databaseConfig.deletes.soft)) {
			softDelete = databaseConfig.deletes.soft
		}

		try {
			if (tableOrView === LLANA_WEBHOOK_TABLE) {
				//perform auth on webhook table
				const auth = await this.authentication.auth({
					table: record.table,
					schema,
					x_request_id,
					access: RolePermission.READ,
					headers: req.headers,
					body: req.body,
					query: req.query,
				})
				if (!auth.valid) {
					return res.status(401).send(auth.message)
				}

				//perform role check
				if (auth.user_identifier) {
					const { valid, message } = (await this.roles.tablePermission({
						identifier: auth.user_identifier,
						table: record.table,
						access: RolePermission.READ,
						x_request_id,
					})) as AuthTablePermissionFailResponse

					if (!valid) {
						return res.status(401).send(this.response.text(message))
					}
				}
				const result = await this.query.perform(
					QueryPerform.DELETE,
					{
						id: id,
						definition,
					},
					x_request_id,
				)
				return res.status(200).send(result)
			}

			const result = await this.query.perform(
				QueryPerform.DELETE,
				{
					id: id,
					definition,
					softDelete,
				},
				x_request_id,
			)
			await this.websocket.publish(definition, PublishType.DELETE, id)
			await this.webhook.publish(definition, PublishType.DELETE, id, auth.user_identifier)
			return res.status(200).send(result)
		} catch (e) {
			return res.status(400).send(this.response.text(e.message))
		}
	}

	@Delete('*/')
	async deleteMany(
		@Req() req,
		@Res() res,
		@Headers() headers: HeaderParams,
		@Body() body: Partial<any>[],
	): Promise<DeleteManyResponseObject> {
		const x_request_id = headers['x-request-id']
		let { schema, tableOrView } = this.query.urlParser(UrlToTable(req.originalUrl, 1))

		if (tableOrView === 'webhook') tableOrView = LLANA_WEBHOOK_TABLE

		let definition: DataSourceDefinition

		try {
			definition = await this.definition.getDefinition(tableOrView, schema, x_request_id)
		} catch (e) {
			return res.status(404).send(this.response.text(e.message))
		}

		const auth = await this.authentication.auth({
			table: tableOrView,
			schema,
			x_request_id,
			access: RolePermission.DELETE,
			headers: req.headers,
			body: req.body,
			query: req.query,
		})
		if (!auth.valid) {
			return res.status(401).send(this.response.text(auth.message))
		}

		//perform role check

		const role_where = []

		if (auth.user_identifier) {
			const permission = await this.roles.tablePermission({
				identifier: auth.user_identifier,
				table: tableOrView,
				access: RolePermission.DELETE,
				x_request_id,
			})

			if (!permission.valid) {
				return res.status(401).send(this.response.text((permission as AuthTablePermissionFailResponse).message))
			}

			if (permission.valid && (permission as AuthTablePermissionSuccessResponse).restriction) {
				role_where.push((permission as AuthTablePermissionSuccessResponse).restriction)
			}
		}

		//validate :id field
		const primary_key = this.definition.getPrimaryKey(definition)

		if (!primary_key) {
			return res.status(400).send(this.response.text(`No primary key found for table ${tableOrView}`))
		}

		if (body instanceof Array) {
			let total = body.length
			let deleted = 0
			let errored = 0
			const errors = []

			for (const item of body) {
				const id = item[primary_key]

				const validateKey = await this.definition.validateData(definition, { [primary_key]: id })
				if (!validateKey.valid) {
					return res.status(400).send(this.response.text(validateKey.message))
				}

				const where = <DataSourceWhere[]>[
					{
						column: primary_key,
						operator: WhereOperator.equals,
						value: id,
					},
				]

				if (role_where.length > 0) {
					where.concat(role_where)
				}

				//Check record exists

				const record = (await this.query.perform(
					QueryPerform.FIND_ONE,
					{
						definition: definition,
						where,
					},
					x_request_id,
				)) as FindOneResponseObject

				if (!record) {
					errored++
					errors.push({
						item: body.indexOf(item),
						message: `Record with id ${id} not found`,
					})
					continue
				}

				//Soft or Hard delete check
				const databaseConfig: DataSourceConfig = this.configService.get('database')

				let softDelete: string = null

				if (
					databaseConfig.deletes.soft &&
					definition.columns.find(col => col.field === databaseConfig.deletes.soft)
				) {
					softDelete = databaseConfig.deletes.soft
				}

				try {
					if (tableOrView === LLANA_WEBHOOK_TABLE) {
						//perform auth on webhook table
						const auth = await this.authentication.auth({
							table: record.table,
							schema,
							x_request_id,
							access: RolePermission.READ,
							headers: req.headers,
							body: req.body,
							query: req.query,
						})
						if (!auth.valid) {
							return res.status(401).send(auth.message)
						}

						//perform role check
						if (auth.user_identifier) {
							const { valid, message } = (await this.roles.tablePermission({
								identifier: auth.user_identifier,
								table: record.table,
								access: RolePermission.READ,
								x_request_id,
							})) as AuthTablePermissionFailResponse

							if (!valid) {
								return res.status(401).send(this.response.text(message))
							}
						}
					}

					await this.query.perform(
						QueryPerform.DELETE,
						{
							id: id,
							definition: definition,
							softDelete,
						},
						x_request_id,
					)
					await this.websocket.publish(definition, PublishType.DELETE, id)
					await this.webhook.publish(definition, PublishType.DELETE, id, auth.user_identifier)
					deleted++
				} catch (e) {
					errored++
					errors.push({
						item: body.indexOf(item),
						message: e.message,
					})
				}
			}

			return res.status(200).send({
				total,
				deleted,
				errored,
				errors,
			} as DeleteManyResponseObject)
		} else {
			return res.status(400).send(this.response.text('Body must be an array'))
		}
	}
}
