import { Body, Controller, Headers, Param, Patch, Put, Req, Res } from '@nestjs/common'

import { LLANA_WEBHOOK_TABLE } from './app.constants'
import { HeaderParams } from './dtos/requests.dto'
import { FindOneResponseObject, IsUniqueResponse, UpdateManyResponseObject } from './dtos/response.dto'
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
	DataSourceDefinition,
	DataSourceWhere,
	PublishType,
	QueryPerform,
	WhereOperator,
} from './types/datasource.types'
import { RolePermission } from './types/roles.types'

@Controller()
export class PutController {
	constructor(
		private readonly authentication: Authentication,
		private readonly query: Query,
		private readonly response: Response,
		private readonly roles: Roles,
		private readonly definition: Definition,
		private readonly websocket: WebsocketService,
		private readonly webhooks: Webhook,
	) {}

	@Put('*/:id')
	async updateById(
		@Req() req,
		@Res() res,
		@Body() body: Partial<any>,
		@Headers() headers: HeaderParams,
		@Param('id') id: string,
	): Promise<FindOneResponseObject> {
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
			access: RolePermission.WRITE,
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
				access: RolePermission.WRITE,
				x_request_id,
			})

			if (!permission.valid) {
				return res.status(401).send(this.response.text((permission as AuthTablePermissionFailResponse).message))
			}

			if (permission.valid && (permission as AuthTablePermissionSuccessResponse).restriction) {
				role_where.push((permission as AuthTablePermissionSuccessResponse).restriction)
			}
		}

		//validate input data
		const validate = await this.definition.validateData(definition, body)
		if (!validate.valid) {
			return res.status(400).send(this.response.text(validate.message))
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

		//validate uniqueness
		const uniqueValidation = (await this.query.perform(
			QueryPerform.UNIQUE,
			{
				definition: definition,
				data: body,
				id: id,
			},
			x_request_id,
		)) as IsUniqueResponse
		if (!uniqueValidation.valid) {
			return res.status(400).send(this.response.text(uniqueValidation.message))
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
			return res.status(400).send(this.response.text(`Record with id ${id} not found`))
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
					QueryPerform.UPDATE,
					{ id, definition: definition, data: validate.instance },
					x_request_id,
				)
				return res.status(200).send(result)
			}

			const result = await this.query.perform(
				QueryPerform.UPDATE,
				{ id, definition: definition, data: validate.instance },
				x_request_id,
			)
			await this.websocket.publish(definition, PublishType.UPDATE, result[definition.primary_key])
			await this.webhooks.publish(
				definition,
				PublishType.UPDATE,
				result[definition.primary_key],
				auth.user_identifier,
			)
			return res.status(200).send(result)
		} catch (e) {
			return res.status(400).send(this.response.text(e.message))
		}
	}

	@Patch('*/:id')
	async updateByIdPatch(
		@Req() req,
		@Res() res,
		@Body() body: Partial<any>,
		@Headers() headers: HeaderParams,
		@Param('id') id: string,
	): Promise<FindOneResponseObject> {
		return await this.updateById(req, res, body, headers, id)
	}

	@Put('*/')
	async updateMany(
		@Req() req,
		@Res() res,
		@Body() body: Partial<any>[],
		@Headers() headers: HeaderParams,
	): Promise<UpdateManyResponseObject> {
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
			access: RolePermission.WRITE,
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
				access: RolePermission.WRITE,
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
			const total = body.length
			let successful = 0
			let errored = 0
			const errors = []
			const data: FindOneResponseObject[] = []

			for (const item of body) {
				//validate input data
				const validate = await this.definition.validateData(definition, item)
				if (!validate.valid) {
					errored++
					errors.push({
						item: body.indexOf(item),
						message: validate.message,
					})
					continue
				}

				const validateKey = await this.definition.validateData(definition, { [primary_key]: item[primary_key] })
				if (!validateKey.valid) {
					errored++
					errors.push({
						item: body.indexOf(item),
						message: validateKey.message,
					})
					continue
				}

				//validate uniqueness
				const uniqueValidation = (await this.query.perform(
					QueryPerform.UNIQUE,
					{
						definition: definition,
						data: item,
						id: item[primary_key],
					},
					x_request_id,
				)) as IsUniqueResponse

				if (!uniqueValidation.valid) {
					errored++
					errors.push({
						item: body.indexOf(item),
						message: uniqueValidation.message,
					})
					continue
				}

				const where = <DataSourceWhere[]>[
					{
						column: primary_key,
						operator: WhereOperator.equals,
						value: item[primary_key],
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
						message: `Record with id ${item[primary_key]} not found`,
					})
					continue
				}

				try {
					if (tableOrView === LLANA_WEBHOOK_TABLE) {
						//perform auth on webhook table
						const auth = await this.authentication.auth({
							table: record.table,
							schema: record.schema || this.query.defaultSchema,
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

					const result = (await this.query.perform(
						QueryPerform.UPDATE,
						{ id: item[primary_key], definition: definition, data: validate.instance },
						x_request_id,
					)) as FindOneResponseObject
					await this.websocket.publish(definition, PublishType.UPDATE, result[definition.primary_key])
					await this.webhooks.publish(
						definition,
						PublishType.UPDATE,
						result[definition.primary_key],
						auth.user_identifier,
					)
					successful++
					data.push(result)
				} catch (e) {
					errored++
					errors.push({
						item: body.indexOf(item),
						message: e.message,
					})
					continue
				}
			}

			return res.status(200).send({
				total,
				successful,
				errored,
				errors,
				data,
			} as UpdateManyResponseObject)
		}

		return res.status(400).send(this.response.text('Body must be an array'))
	}

	@Patch('*/')
	async updateManyPatch(
		@Req() req,
		@Res() res,
		@Body() body: Partial<any>[],
		@Headers() headers: HeaderParams,
	): Promise<UpdateManyResponseObject> {
		return await this.updateMany(req, res, body, headers)
	}
}
