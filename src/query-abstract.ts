import assert from 'assert';

export type BoundValue = string | number;

// TODO: Types for this interface
export interface DriverConnection {
	query(sql: string, values?: BoundValue[]): Promise<[any[], any]>;
}

export interface QueryInterface {
	query<RowT>(sql: string, values: BoundValue[]): Promise<RowT[]>;
	select<RowT>(...args: unknown[]): Promise<RowT[]>;
}

export interface Conds {
	[key: string]: BoundValue;
}

export type Order = [string, 'asc' | 'desc'];
export type OrderMult = Order[];

export interface Opts {
	limit?: number;
	offset?: number;
	order?: Order | OrderMult;
}

export type SelectArgz =
	[string] |                             // table
	[string, Conds] |                      // table, conds
	[string, Conds, Opts] |                // table, conds, opts
	[string, undefined, Opts] |            // table, [conds], opts
	[string[], string] |                   // columns, table
	[string[], string, Conds] |            // columns, table, conds
	[string[], string, Conds, Opts] |      // columns, table, conds, opts
	[string[], string, undefined, Opts];   // columns, table, [conds], opts

export interface SelectArgs {
	table: string;
	cols: string[];
	conds?: Conds;
	opts?: Opts;
}

/**
 * We want the same query interface for transactions and non-transactions. The
 * difference is that we want to use a specific connection when executing
 * transactions. We share all common functionality between the two in this
 * abstract class.
 */
export abstract class QueryInterfaceAbstract implements QueryInterface {
	protected abstract async getConnection (): Promise<DriverConnection>;

	/**
	 * Executes a query by using a connection from _getConnection.
	 */
	async query<RowT>(
		sql: string,
		values: BoundValue[] = []
	): Promise<RowT[]> {
		const con = await this.getConnection()
		const [_results] = await con.query(sql, values)
		const results: unknown = _results;
		return results as RowT[];
	}

	protected parseSelectArgs(args: unknown[]): SelectArgs {
		const argOffset = Array.isArray(args[0]) ? 0 : -1;
		const columns = argOffset === 0 ? args[argOffset] : ['*'];
		const table = args[argOffset + 1];
		const conds = args[argOffset + 2] || undefined;
		const opts = args[argOffset + 3] || undefined;

		assert.ok(typeof table === 'string', 'Table must be string');
		assert.ok(Array.isArray(columns), 'Columns must be array of strings');

		return {
			table,
			cols: columns.map(c => String(c)),
			conds: conds && this.parseConds(conds),
			opts: opts && this.parseOpts(opts),
		};
	}

	protected parseConds (conds: unknown): Conds {
		assert.ok(typeof conds === 'object');
		assert.ok(conds !== null);

		for (const val of Object.values(conds)) {
			assert.ok(typeof val === 'number' || typeof val === 'string');
		}

		return conds as Conds;
	}

	protected parseOpts (_opts: unknown): Opts {
		assert.ok(typeof _opts === 'object');
		assert.ok(_opts !== null);

		const opts = _opts as Opts;

		if (opts.limit) {
			assert.ok(typeof opts.limit === 'number');
		}

		if (opts.offset) {
			assert.ok(typeof opts.offset === 'number');
		}

		function validateOrderItem (item: unknown): item is Order {
			assert.ok(Array.isArray(item));

			assert.ok(typeof item[0] === 'string');
			assert.ok(typeof item[1] === 'string');
			assert.ok(['asc', 'desc'].includes(item[1]));

			return true;
		}

		if (opts.order) {
			assert.ok(Array.isArray(opts.order));

			if (typeof opts.order[0] === 'string') {
				validateOrderItem(opts.order);
			} else {
				for (const item of opts.order) {
					validateOrderItem(item);
				}
			}
		}

		return opts as Opts;
	}

	/**
	 * Arguments: cols (optional), table, where = null, opts = {}
	 */
	async select<RowT>(...args: unknown[]): Promise<RowT[]>  {
		const { table, cols, conds, opts } = this.parseSelectArgs(args);

		let sql = 'SELECT';
		const values: BoundValue[] = [];

		// Apply column selection
		sql += ' ' + cols.map(c => this.strWrap(c, '`')).join(', ')
		sql += ' FROM ' + this.strWrap(table, '`')

		if (conds) {
			sql += this.applyWhereCondition(conds, values)
		}

		if (opts && opts.order) {
			sql += this.applyOrder(opts.order)
		}

		if (opts && opts.limit) {
			sql += this.applyLimit(values, opts.limit, opts.offset)
		}

		return this.execute(sql, values)
	}

	/**
	 * Insert. Data can be either a single object, or an array of uniform
	 * objects.
	 */
	// TODO: extends what?
	async insert<RowT extends { [key: string]: BoundValue }>(
		table: string,
		data: Partial<RowT> | Partial<RowT>[],
	): Promise<void> {
		let sql = `INSERT INTO ${this.strWrap(table, '`')}`;
		const values: BoundValue[] = [];

		// Wrap single data object into array to be able to handle both bulk an
		// normal insertions in the same way.
		const rows = !Array.isArray(data)
			? [data]
			: data;
		assert.ok(rows.length > 0, 'There must be atleast one row to insert.');

		const firstRow = rows[0];
		const firstRowKeys = Object.keys(firstRow);
		const valuePlaceholder = '(' + firstRowKeys.map(() => '?')
			.join(', ') + ')';

		// Append the columns that will be updated based on the first object.
		sql += ' ('
		sql += firstRowKeys
			.map(k => this.strWrap(k, '`'))
			.join(', ');
		sql += ') VALUES ';

		sql += rows
			.map(row => {
				values.push(...Object.values(row))
				return valuePlaceholder
			})
			.join(', ')

		return this.execute(sql, values)
	}

	/**
	 * Update. Note that opts.offset will not be respected in the same way as
	 * insert, since MySQL does not support updates with offset.
	 */
	// TODO: extend what?
	async update<RowT extends { [key: string]: BoundValue }>(
		table: string,
		data: RowT,
		conds?: Conds,
		opts?: Opts,
	): Promise<void> {
		let sql = 'UPDATE ' + this.strWrap(table, '`') + ' SET';
		const values: BoundValue[] = [];

		sql += ' ' + Object.keys(data)
			.map(k => {
				values.push(data[k])
				return this.strWrap(k, '`') + ' = ?'
			})
			.join(', ')

		if (conds) {
			sql += this.applyWhereCondition(conds, values);
		}

		if (opts && opts.order) {
			sql += this.applyOrder(opts.order);
		}

		if (opts && opts.limit) {
			sql += this.applyLimit(values, opts.limit);
		}

		return this.execute(sql, values);
	}

	/**
	 * Delete. Note that opts.offset will not be respected in the same way as
	 * insert, since MySQL does not support delete's with offset.
	 */
	async delete (
		table: string,
		conds?: Conds,
		opts?: Opts
	): Promise<void> {
		let sql = 'DELETE';
		const values: BoundValue[] = []

		sql += ' FROM ' + this.strWrap(table, '`');

		if (conds) {
			sql += this.applyWhereCondition(conds, values);
		}

		if (opts && opts.order) {
			sql += this.applyOrder(opts.order);
		}

		if (opts && opts.limit) {
			sql += this.applyLimit(values, opts.limit);
		}

		return this.execute(sql, values);
	}

	/**
	 * Construct condition (WHERE clause) from condition object. Note that this
	 * will mutate the values array by adding bound parameters to it.
	 */
	protected applyWhereCondition (
		conds: Conds,
		values: BoundValue[]
	): string {
		return ' WHERE ' + Object
			.keys(conds)
			.map(k => {
				values.push(conds[k])
				return '`' + k + '` = ?'
			})
			.join(' AND ');
	}

	/**
	 * Applies order to select(?) query.
	 */
	applyOrder (order: Order | OrderMult): string {
		// Wrap single order array to be able to handle it in the same way
		const orderings: OrderMult = !Array.isArray(order[0])
			? [order]
			: order;

		return ' ORDER BY ' + orderings
			.map((o: Order) => {
				return this.strWrap(o[0], '`') + ' ' + o[1].toUpperCase();
			})
			.join(', ')
	}

	/**
	 * Constructs limit clause. Note that this will mutate the values array by
	 * adding the limit/offset values as bound parameter values.
	 */
	protected applyLimit (
		values: BoundValue[],
		limit: number,
		offset?: number
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

	protected strWrap (str: string, char: string): string {
		return `${char}${str}${char}`;
	}

	protected async execute (
		sql: string,
		values: BoundValue[],
	): Promise<any> {
		const con = await this.getConnection();
		const driverArgs: [string, BoundValue[]|undefined] = [sql, undefined];

		// Parameter bindings
		if (values.length) {
			driverArgs.splice(1, 1, values);
		}

		const [result] = await con.query(...driverArgs);
		return result;
	}
}
