import assert from 'assert';
import type { Pool, Connection, PoolConnection } from 'mysql2/promise';

import type {
	BindValue,
	QueryInterface,
	Condition,
	Opts,
	OrderBy,
	Order,
	Row,
} from './types';

export class QueryBase implements QueryInterface {
	constructor(protected driver: Pool | Connection | PoolConnection) {}

	async query<RowT>(sql: string, values?: BindValue[]): Promise<RowT[]> {
		return this.execute(sql, values);
	}

	async queryOne<RowT>(sql: string, values?: BindValue[]): Promise<RowT> {
		const rows = await this.execute<RowT>(sql, values);

		if (rows.length !== 1 || !rows[0]) {
			throw new Error(`Expected one row, got ${rows.length} rows`);
		}

		return rows[0];
	}

	async select<RowT extends Row>(
		tableOrCols: string | string[],
		tableOrCond?: string | Condition<RowT>,
		condOrOpts?: Condition<RowT> | Opts,
		opts?: Opts,
	): Promise<RowT[]> {
		let table: string;
		let cols: string[] | '*';
		let cond: Condition<RowT> | undefined;
		let opt: Opts | undefined;

		if (typeof tableOrCols === 'string') {
			table = tableOrCols;
			cols = '*';
			cond = tableOrCond ? (tableOrCond as typeof cond) : undefined;
			opt = condOrOpts ? (condOrOpts as typeof opts) : undefined;
		} else {
			cols = tableOrCols;
			table = tableOrCond as typeof table;
			cond = condOrOpts ? (condOrOpts as typeof cond) : undefined;
			opt = opts;
		}

		let sql = 'SELECT';
		const values: string[] = [];

		// Apply column selection
		if (cols === '*') {
			sql += ' *';
		} else {
			sql += ' ' + cols.map((c) => this.strWrap(c)).join(', ');
		}

		sql += ' FROM ' + this.strWrap(table);

		if (cond) {
			sql += this.applyWhereCondition(cond, values);
		}

		if (opt?.order) {
			sql += this.applyOrder(opt.order);
		}

		if (opt?.limit) {
			sql += this.applyLimit(values, opt.limit, opt.offset);
		}

		return this.execute(sql, values);
	}

	async selectOne<RowT extends Row>(
		tableOrCols: string | string[],
		tableOrCond?: string | Condition<RowT>,
		condOrOpts?: Condition<RowT> | Opts,
		opts?: Opts,
	): Promise<RowT> {
		const rows = await this.select(tableOrCols, tableOrCond, condOrOpts, opts);

		if (rows.length !== 1 || !rows[0]) {
			throw new Error(`Expected one row, got ${rows.length} rows`);
		}

		return rows[0];
	}

	async insert<RowT>(table: string, data: RowT | RowT[]): Promise<unknown> {
		let sql = `INSERT INTO ${this.strWrap(table)}`;
		const values: BindValue[] = [];

		const rows = !Array.isArray(data) ? [data] : data;
		assert.ok(rows.length > 0, 'There must be atleast one row to insert.');

		const firstRow = rows[0]!;
		const firstRowKeys = Object.keys(firstRow);
		const valuePlaceholder =
			'(' + firstRowKeys.map((_) => '?').join(', ') + ')';

		// Append the columns that will be updated based on the first object.
		sql += ' (';
		sql += firstRowKeys.map((k) => this.strWrap(k)).join(', ');
		sql += ') VALUES ';

		sql += rows
			.map((row) => {
				values.push(...Object.values(row));
				return valuePlaceholder;
			})
			.join(', ');

		return this.execute(sql, values);
	}

	async update<RowT extends Row>(
		table: string,
		data: Partial<RowT>,
		cond?: Condition<RowT>,
		opts?: Opts,
	): Promise<unknown> {
		let sql = 'UPDATE ' + this.strWrap(table) + ' SET';
		const values: BindValue[] = [];
		const keys = Object.keys(data);

		if (!keys.length) {
			return;
		}

		sql +=
			' ' +
			keys
				.map((k) => {
					values.push(data[k]!);
					return this.strWrap(k) + ' = ?';
				})
				.join(', ');

		if (cond) {
			sql += this.applyWhereCondition(cond, values);
		}

		if (opts?.order) {
			sql += this.applyOrder(opts.order);
		}

		if (opts?.limit) {
			sql += this.applyLimit(values, opts.limit);
		}

		if (opts?.offset) {
			throw new Error('offset not supported on updates using MySQL');
		}

		return this.execute(sql, values);
	}

	async delete<RowT extends Row>(
		table: string,
		cond?: Condition<RowT>,
		opts?: Opts,
	): Promise<unknown> {
		let sql = 'DELETE';
		const values: BindValue[] = [];

		sql += ' FROM ' + this.strWrap(table);

		if (cond) {
			sql += this.applyWhereCondition(cond, values);
		}

		if (opts?.order) {
			sql += this.applyOrder(opts.order);
		}

		if (opts?.limit) {
			sql += this.applyLimit(values, opts.limit);
		}

		if (opts?.offset) {
			throw new Error('offset not supported on deletes using MySQL');
		}

		return this.execute(sql, values);
	}

	async getLastInsertId(): Promise<number> {
		if (this.isPool(this.driver)) {
			throw new Error(
				'getLastInsertId is not predictable on pool connection, use a normal connection or transaction instead.',
			);
		}

		const [row] = await this.execute<{ id: number }>(
			'SELECT LAST_INSERT_ID() as id',
		);

		if (!row || row.id === 0) {
			throw new Error('No LAST_INSERT_ID found');
		}

		return row.id;
	}

	// Protected below...

	protected strWrap(str: string, char = '`'): string {
		return `${char}${str}${char}`;
	}

	protected applyWhereCondition(
		cond: Condition<any>,
		values: BindValue[],
	): string {
		return (
			' WHERE ' +
			Object.keys(cond)
				.map((k) => {
					values.push(cond[k]!);

					return '`' + k + '`' + (Array.isArray(cond[k]!) ? ' IN(?)' : ' = ?');
				})
				.join(' AND ')
		);
	}

	protected applyOrder(order: OrderBy): string {
		const orderings = Array.isArray(order[0])
			? (order as Order[])
			: [order as Order];

		return (
			' ORDER BY ' +
			orderings
				.map((o) => this.strWrap(o[0]) + ' ' + o[1].toUpperCase())
				.join(', ')
		);
	}

	protected applyLimit(
		values: BindValue[],
		limit: number,
		offset?: number,
	): string {
		let sql = '';

		if (offset) {
			sql += ' LIMIT ?, ?';
			values.push(offset, limit);
		} else {
			sql = ' LIMIT ?';
			values.push(limit);
		}

		return sql;
	}

	protected async execute<RowT>(
		sql: string,
		values?: BindValue[],
	): Promise<RowT[]> {
		const con = await this.getConnection();
		const [result] = await con.query(sql, values);
		this.closeConnection(con);
		return result as RowT[];
	}

	protected async getConnection(): Promise<Connection | PoolConnection> {
		if (this.isPool(this.driver)) {
			return this.driver.getConnection();
		}

		return this.driver;
	}

	protected async closeConnection(
		con: Connection | PoolConnection,
	): Promise<void> {
		if (this.isPoolConnection(con)) {
			return con.release();
		}
	}

	protected isPool(driver: Pool | Connection): driver is Pool {
		return 'getConnection' in driver;
	}

	protected isPoolConnection(
		con: Connection | PoolConnection,
	): con is PoolConnection {
		return 'release' in con;
	}
}
