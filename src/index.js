/**
 * TODO:
 * - Create separation between drivers and internals. This is currently using
 *   the mysql2 interface 1:1 without separation.
 */

class QueryInterfaceAbstract {
	async _getConnection() {
		throw new Error('Not implemented')
	}

	async query (sql, values = []) {
		const con = await this._getConnection()
		const [results] = await con.query(sql, values)
		return results
	}

	// TODO: Construct SQL
	async select (...args) {
		const argOffset = Array.isArray(args[0]) ? 0 : 1
		const attrs = args[argOffset + 0]
		const table = args[argOffset + 1]
		const where = args[argOffset + 2] || null
		const opts = args[argOffset + 3] || null

		assert.ok(typeof table === 'string', 'Table must be')
		if (Array.isArray(args[0])) {
			attrs = args[0]
			table = args[1]
			where = args[1]
		}


		attrs, table, where = null, opts = {}
	}

	// TODO: Construct SQL
	async insert (table, data) {
	}

	// TODO: Construct SQL
	async delete (table, where) {
	}
}

class MySQL2Extended extends QueryInterfaceAbstract {
	constructor (driverInstance) {
		super()
		this.driverInstance = driverInstance
	}

	// Implements QueryInterfaceAbstract._getConnection by using a new
	// connection from the driver.
	async _getConnection() {
		return this.driverInstance.getConnection()
	}

	// Fetches a connection from the driver and creates a transaction context
	async begin () {
		const con = await this._getConnection()
		return new TransactionContext(con)
	}

	// Managed transaction (auto rollback)
	async transaction (callback) {
		const transaction = await this.begin()

		try {
			await callback(transaction)
			await transaction.commit()
		} catch (err) {
			// Error somewhere in the user code, roll back and throw
			await transaction.rollback()
			throw err
		}
	}
}

class TransactionContext extends QueryInterfaceAbstract {
	constructor(con) {
		super()
		this.con = con
	}

	// Implement QueryInterfaceAbstract._getConnection by reusing the one
	// connection.
	async _getConnection() {
		return this.con
	}

	async commit() {
		return this.con.query('COMMIT')
	}

	async rollback() {
		return this.con.query('ROLLBACK')
	}
}

module.exports = MySQL2Extended
