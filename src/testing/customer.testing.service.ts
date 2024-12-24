import { faker } from '@faker-js/faker'
import { Injectable } from '@nestjs/common'

import { FindOneResponseObject } from '../dtos/response.dto'
import { Definition } from '../helpers/Definition'
import { Query } from '../helpers/Query'
import { QueryPerform } from '../types/datasource.types'

const table = 'Customer'

@Injectable()
export class CustomerTestingService {
	constructor(
		private readonly query: Query,
		private readonly definition: Definition,
	) {}

	mockCustomer(): any {
		return {
			custId: faker.number.int({
				min: 1000,
				max: 9999,
			}),
			companyName: faker.company.name(),
			contactName: faker.person.firstName() + ', ' + faker.person.lastName(),
			contactTitle: faker.person.prefix(),
			address: faker.location.streetAddress(),
			city: faker.location.city().substring(0, 10),
			region: faker.location.state(),
			postalCode: faker.location.zipCode(),
			country: faker.location.countryCode(),
			email: faker.internet.email(),
		}
	}

	async getDef(item?: string): Promise<any> {
		if (!item) item = table
		return await this.definition.getDefinition(item, this.query.defaultSchema, 'testing')
	}

	async createCustomer(customer: any): Promise<any> {
		const definition = await this.getDef()
		const CUSTOMER = this.mockCustomer()

		return (await this.query.perform(
			QueryPerform.CREATE,
			{
				definition,
				data: {
					...CUSTOMER,
					...customer,
				},
			},
			'testing',
		)) as FindOneResponseObject
	}

	async deleteCustomer(customer_id: any): Promise<void> {
		const definition = await this.getDef()
		await this.query.perform(
			QueryPerform.DELETE,
			{
				definition,
				id: customer_id,
			},
			'testing',
		)
	}
}
