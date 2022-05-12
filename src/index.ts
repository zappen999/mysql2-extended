import type { Connection, Pool, PoolConnection } from 'mysql2/promise';

import { QueryBase } from './query-base';

export * from './types';

export class MySQL2Extended extends QueryBase {
	constructor(protected driver: Pool | Connection | PoolConnection) {
		super(driver);
	}

	async begin(): Promise<Transaction> {
		const con = await this.getConnection();
		const transactionContext = new Transaction(con);
		await transactionContext._begin();
		return transactionContext;
	}

	async transaction<ResultT>(
		callback: (transaction: Transaction) => Promise<ResultT>,
	): Promise<ResultT> {
		const transaction = await this.begin();

		let result;

		try {
			result = await callback(transaction);
			await transaction.commit();
		} catch (err) {
			await transaction.rollback();
			throw err;
		}

		return result;
	}
}

export class Transaction extends QueryBase {
	protected hasBegin = false;
	protected lastAction?: 'COMMIT' | 'ROLLBACK';

	constructor(protected con: Connection | PoolConnection) {
		super(con);
	}

	async _begin(): Promise<void> {
		if (this.hasBegin) {
			throw new Error('Transaction has already began');
		}

		await this.con.query('BEGIN');
	}

	async commit(): Promise<void> {
		this.validateCleanAndMarkDirty('COMMIT');

		await this.con.query('COMMIT');
	}

	async rollback(): Promise<void> {
		this.validateCleanAndMarkDirty('ROLLBACK');

		await this.con.query('ROLLBACK');
	}

	validateCleanAndMarkDirty(action: 'COMMIT' | 'ROLLBACK') {
		if (!this.lastAction) {
			this.lastAction = action;
			return;
		}

		throw new Error(
			`Cannot ${action} transaction. Already got ${this.lastAction}`,
		);
	}
}
