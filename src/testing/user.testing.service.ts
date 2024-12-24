import { faker } from '@faker-js/faker'
import { Injectable } from '@nestjs/common'

import { FindOneResponseObject } from '../dtos/response.dto'
import { Definition } from '../helpers/Definition'
import { Query } from '../helpers/Query'
import { QueryPerform } from '../types/datasource.types'

const table = 'User'

@Injectable()
export class UserTestingService {
	constructor(
		private readonly query: Query,
		private readonly definition: Definition,
	) {}

	mockUser(): any {
		return {
			email: faker.internet.email(),
			password: faker.internet.password(),
			role: 'USER',
			firstName: faker.person.firstName(),
			lastName: faker.person.lastName(),
		}
	}

	async getDef(item?: string): Promise<any> {
		if (!item) item = table
		return await this.definition.getDefinition(item, this.query.defaultSchema, 'testing')
	}

	async createUser(user: any): Promise<any> {
		const definition = await this.getDef()

		const USER = this.mockUser()

		return (await this.query.perform(
			QueryPerform.CREATE,
			{
				definition,
				data: {
					...USER,
					...user,
				},
			},
			'testing',
		)) as FindOneResponseObject
	}

	async deleteUser(user_id: any): Promise<void> {
		const definition = await this.getDef()
		await this.query.perform(
			QueryPerform.DELETE,
			{
				definition,
				id: user_id,
			},
			'testing',
		)
	}
}
