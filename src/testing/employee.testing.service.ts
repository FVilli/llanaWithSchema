import { faker } from '@faker-js/faker'
import { Injectable } from '@nestjs/common'

import { FindOneResponseObject } from '../dtos/response.dto'
import { Definition } from '../helpers/Definition'
import { Query } from '../helpers/Query'
import { QueryPerform } from '../types/datasource.types'

const table = 'Employee'

@Injectable()
export class EmployeeTestingService {
	constructor(
		private readonly query: Query,
		private readonly definition: Definition,
	) {}

	mockEmployee(): any {
		return {
			employeeId: faker.number.int({
				min: 1000,
				max: 9999,
			}),
			email: faker.internet.email(),
			notes: null,
			phone: faker.phone.number(),
			photo: null,
			title: faker.person.jobTitle().slice(0, 10),
			mobile: null,
			lastName: faker.person.lastName(),
			firstName: faker.person.firstName(),
			hireDate: faker.date.past(),
			address: faker.location.streetAddress(),
			city: faker.location.city().substring(0, 10),
			region: faker.location.state(),
			postalCode: faker.location.zipCode(),
			country: faker.location.countryCode(),
			extension: null,
			birthDate: faker.date.past(),
			photoPath: null,
			titleOfCourtesy: faker.person.prefix(),
		}
	}

	async getDef(item?: string): Promise<any> {
		if (!item) item = table
		return await this.definition.getDefinition(item, this.query.defaultSchema, 'testing')
	}
	async createEmployee(employee: any): Promise<any> {
		const definition = await this.getDef()

		const EMPLOYEE = this.mockEmployee()

		return (await this.query.perform(
			QueryPerform.CREATE,
			{
				definition,
				data: {
					...EMPLOYEE,
					...employee,
				},
			},
			'testing',
		)) as FindOneResponseObject
	}

	async getEmployee(): Promise<any> {
		const definition = await this.getDef()

		return (await this.query.perform(
			QueryPerform.FIND_ONE,
			{
				definition: definition,
			},
			'testing',
		)) as FindOneResponseObject
	}

	async deleteEmployee(employee_id: any): Promise<void> {
		const definition = await this.getDef()
		await this.query.perform(
			QueryPerform.DELETE,
			{
				definition: definition,
				id: employee_id,
			},
			'testing',
		)
	}
}
