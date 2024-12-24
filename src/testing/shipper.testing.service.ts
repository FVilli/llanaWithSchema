import { faker } from '@faker-js/faker'
import { Injectable } from '@nestjs/common'

import { FindOneResponseObject } from '../dtos/response.dto'
import { Definition } from '../helpers/Definition'
import { Query } from '../helpers/Query'
import { QueryPerform } from '../types/datasource.types'

const table = 'Shipper'
@Injectable()
export class ShipperTestingService {
	constructor(
		private readonly query: Query,
		private readonly definition: Definition,
	) {}

	mockShipper(): any {
		return {
			shipperId: faker.number.int({
				min: 1000,
				max: 9999,
			}),
			phone: faker.phone.number(),
			companyName: faker.company.name(),
		}
	}

	async getDef(item?: string): Promise<any> {
		if (!item) item = table
		return await this.definition.getDefinition(item, this.query.defaultSchema, 'testing')
	}

	async createShipper(shipper: any): Promise<any> {
		const definition = await this.getDef()

		const SHIPPER = this.mockShipper()

		return (await this.query.perform(
			QueryPerform.CREATE,
			{
				definition,
				data: {
					...SHIPPER,
					...shipper,
				},
			},
			'testing',
		)) as FindOneResponseObject
	}

	async getShipper(): Promise<any> {
		const definition = await this.getDef()

		return (await this.query.perform(
			QueryPerform.FIND_ONE,
			{
				definition,
			},
			'testing',
		)) as FindOneResponseObject
	}

	async deleteShipper(shipper_id: any): Promise<void> {
		const definition = await this.getDef()
		await this.query.perform(
			QueryPerform.DELETE,
			{
				definition,
				id: shipper_id,
			},
			'testing',
		)
	}
}
