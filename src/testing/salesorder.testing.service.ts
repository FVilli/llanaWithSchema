import { faker } from '@faker-js/faker'
import { Injectable } from '@nestjs/common'

import { FindOneResponseObject } from '../dtos/response.dto'
import { Definition } from '../helpers/Definition'
import { Query } from '../helpers/Query'
import { QueryPerform } from '../types/datasource.types'

const table = 'SalesOrder'

@Injectable()
export class SalesOrderTestingService {
	constructor(
		private readonly query: Query,
		private readonly definition: Definition,
	) {}

	mockOrder(): any {
		return {
			orderId: faker.number.int({
				min: 1000,
				max: 9999,
			}),
			orderDate: faker.date.past().toISOString(),
			requiredDate: faker.date.past().toISOString(),
			shippedDate: faker.date.past().toISOString(),
			freight: faker.number.float(),
			shipName: faker.company.name(),
			shipAddress: faker.location.streetAddress(),
			shipCity: faker.location.city().substring(0, 15),
			shipPostalCode: faker.location.zipCode(),
			shipCountry: faker.location.countryCode(),
		}
	}

	async getDef(item?: string): Promise<any> {
		if (!item) item = table
		return await this.definition.getDefinition(item, this.query.defaultSchema, 'testing')
	}
	async createOrder(order: { custId; employeeId; shipperId; orderId? }): Promise<any> {
		const definition = await this.getDef()

		const ORDER = this.mockOrder()

		return (await this.query.perform(
			QueryPerform.CREATE,
			{
				definition,
				data: {
					...ORDER,
					...order,
				},
			},
			'testing',
		)) as FindOneResponseObject
	}

	async deleteOrder(id: any): Promise<void> {
		const definition = await this.getDef()
		await this.query.perform(
			QueryPerform.DELETE,
			{
				definition,
				id,
			},
			'testing',
		)
	}
}
