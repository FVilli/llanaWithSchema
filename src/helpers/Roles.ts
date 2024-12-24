import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cache } from 'cache-manager'

import { CACHE_DEFAULT_IDENTITY_DATA_TTL, LLANA_ROLES_TABLE } from '../app.constants'
import { FindManyResponseObject } from '../dtos/response.dto'
import { AuthTablePermissionFailResponse, AuthTablePermissionSuccessResponse } from '../types/auth.types'
import { QueryPerform, WhereOperator } from '../types/datasource.types'
import { RolePermission, RolesConfig } from '../types/roles.types'
import { Definition } from './Definition'
import { Logger } from './Logger'
import { Query } from './Query'

@Injectable()
export class Roles {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly configService: ConfigService,
		private readonly logger: Logger,
		private readonly query: Query,
		private readonly definition: Definition,
	) {}

	/**
	 * Check if a role has permission to access a table
	 */

	async tablePermission(options: {
		identifier: string
		table: string
		access: RolePermission
		x_request_id: string
	}): Promise<AuthTablePermissionSuccessResponse | AuthTablePermissionFailResponse> {
		const config = this.configService.get<RolesConfig>('roles')

		if (!config.location?.table || !config.location?.column) {
			this.logger.warn('Roles table not defined, skipping role check')
			return <AuthTablePermissionSuccessResponse>{
				valid: true,
			}
		}

		let permission_result = await this.cacheManager.get<
			AuthTablePermissionSuccessResponse | AuthTablePermissionFailResponse
		>(`roles:${options.identifier}:${options.table}:${options.access}`)

		if (permission_result?.valid) {
			return permission_result
		}

		const definition = await this.definition.getDefinition(
			options.table,
			this.query.defaultSchema,
			options.x_request_id,
		)

		if (!definition) {
			permission_result = <AuthTablePermissionFailResponse>{
				valid: false,
				message: 'Table not found',
			}
			await this.cacheManager.set(
				`roles:${options.identifier}:${options.table}:${options.access}`,
				permission_result,
				CACHE_DEFAULT_IDENTITY_DATA_TTL,
			)
			return permission_result
		}

		let role

		try {
			role = await this.getRole(options.identifier, options.x_request_id)
		} catch (e) {
			permission_result = <AuthTablePermissionFailResponse>{
				valid: false,
				message: e.message,
			}
			await this.cacheManager.set(
				`roles:${options.identifier}:${options.table}:${options.access}`,
				permission_result,
				CACHE_DEFAULT_IDENTITY_DATA_TTL,
			)
			return permission_result
		}

		if (!role) {
			permission_result = <AuthTablePermissionFailResponse>{
				valid: false,
				message: 'Role not found',
			}
			await this.cacheManager.set(
				`roles:${options.identifier}:${options.table}:${options.access}`,
				permission_result,
				CACHE_DEFAULT_IDENTITY_DATA_TTL,
			)
			return permission_result
		}

		const permission_definition = await this.definition.getDefinition(
			LLANA_ROLES_TABLE,
			this.query.defaultSchema,
			options.x_request_id,
		)

		const custom_permissions = (await this.query.perform(
			QueryPerform.FIND_MANY,
			{
				definition: permission_definition,
				where: [
					{
						column: 'custom',
						operator: WhereOperator.equals,
						value: true,
					},
					{
						column: 'table',
						operator: WhereOperator.equals,
						value: options.table,
					},
					{
						column: 'role',
						operator: WhereOperator.equals,
						value: role,
					},
				],
			},
			options.x_request_id,
		)) as FindManyResponseObject

		// check if there is a table role setting
		if (custom_permissions.data?.length) {
			for (const permission of custom_permissions.data) {
				if (this.rolePass(options.access, permission.records)) {
					permission_result = <AuthTablePermissionSuccessResponse>{
						valid: true,
					}
					await this.cacheManager.set(
						`roles:${options.identifier}:${options.table}:${options.access}`,
						permission_result,
						CACHE_DEFAULT_IDENTITY_DATA_TTL,
					)
					return permission_result
				}

				if (this.rolePass(options.access, permission.own_records)) {
					permission_result = <AuthTablePermissionSuccessResponse>{
						valid: true,
						restriction: {
							column: permission.identity_column ?? definition.primary_key,
							operator: WhereOperator.equals,
							value: options.identifier,
						},
					}
					await this.cacheManager.set(
						`roles:${options.identifier}:${options.table}:${options.access}`,
						permission_result,
						CACHE_DEFAULT_IDENTITY_DATA_TTL,
					)
					return permission_result
				}
			}
		}

		const default_permissions = (await this.query.perform(
			QueryPerform.FIND_MANY,
			{
				definition: permission_definition,
				where: [
					{
						column: 'custom',
						operator: WhereOperator.equals,
						value: false,
					},
					{
						column: 'role',
						operator: WhereOperator.equals,
						value: role,
					},
				],
			},
			options.x_request_id,
		)) as FindManyResponseObject

		if (default_permissions.data?.length) {
			for (const permission of default_permissions.data) {
				if (this.rolePass(options.access, permission.records)) {
					permission_result = <AuthTablePermissionSuccessResponse>{
						valid: true,
					}
					await this.cacheManager.set(
						`roles:${options.identifier}:${options.table}:${options.access}`,
						permission_result,
						CACHE_DEFAULT_IDENTITY_DATA_TTL,
					)
					return permission_result
				}
			}
		}

		permission_result = <AuthTablePermissionFailResponse>{
			valid: false,
			message: `Table Action ${options.access} - Permission Denied For Role ${role}`,
		}
		await this.cacheManager.set(
			`roles:${options.identifier}:${options.table}:${options.access}`,
			permission_result,
			CACHE_DEFAULT_IDENTITY_DATA_TTL,
		)
		return permission_result
	}

	/**
	 * Get users role from the database
	 */

	private async getRole(identifier: string, x_request_id: string): Promise<string | undefined> {
		const config = this.configService.get<RolesConfig>('roles')

		let definition

		try {
			definition = await this.definition.getDefinition(
				config.location.table,
				this.query.defaultSchema,
				x_request_id,
			)
		} catch (e) {
			throw new Error(e)
		}

		const user_id_column = config.location?.identifier_column ?? definition.primary_key

		const role = await this.query.perform(
			QueryPerform.FIND_ONE,
			{
				definition,
				fields: [config.location.column],
				where: [
					{
						column: user_id_column,
						operator: WhereOperator.equals,
						value: identifier,
					},
				],
			},
			x_request_id,
		)

		return role?.[config.location.column]
	}

	rolePass(access: RolePermission, permission: RolePermission): boolean {
		switch (access) {
			case RolePermission.NONE:
				return false
			case RolePermission.READ:
				return (
					permission === RolePermission.READ ||
					permission === RolePermission.WRITE ||
					permission === RolePermission.DELETE
				)
			case RolePermission.WRITE:
				return permission === RolePermission.WRITE || permission === RolePermission.DELETE
			case RolePermission.DELETE:
				return permission === RolePermission.DELETE
		}
	}
}
