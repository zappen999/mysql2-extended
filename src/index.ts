import type { Pool } from 'mysql2/promise';

import { QueryBase } from './query-base';
import type { SingleConnection, GlobalOpts } from './types';

export * from './types';

export class MySQL2Extended extends QueryBase {
	constructor(
		protected driver: Pool | SingleConnection,
		protected opts?: GlobalOpts,
	) {
		super(driver, opts);
	}

	async begin(): Promise<Transaction> {
		const con = await this.getConnection();
		const transactionContext = new Transaction(con, this.opts);
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

	constructor(protected con: SingleConnection, protected opts?: GlobalOpts) {
		super(con, opts);
	}

	async _begin(): Promise<void> {
		if (this.hasBegin) {
			throw new Error('Transaction has already began');
		}

		await this.execute('BEGIN');
	}

	async commit(): Promise<void> {
		this.validateCleanAndMarkDirty('COMMIT');

		await this.execute('COMMIT');
	}

	async rollback(): Promise<void> {
		this.validateCleanAndMarkDirty('ROLLBACK');

		await this.execute('ROLLBACK');
	}

	protected async getConnection(): Promise<SingleConnection> {
		return this.con;
	}

	validateCleanAndMarkDirty(action: 'COMMIT' | 'ROLLBACK'): void {
		if (!this.lastAction) {
			this.lastAction = action;
			return;
		}

		throw new Error(
			`Cannot ${action} transaction. Already got ${this.lastAction}`,
		);
	}
}
