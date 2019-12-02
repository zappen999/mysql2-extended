const assert = require('assert')

/**
 * We want the same query interface for transactions and non-transactions. The
 * difference is that we want to use a specific connection when executing
 * transactions. We share all common functionality between the two in this
 * abstract class.
 */
class QueryInterfaceAbstract {
  async _getConnection () {
    throw new Error('Not implemented')
  }

  /**
   * Executes a query by using a connection from _getConnection.
   */
  async query (sql, values = []) {
    const con = await this._getConnection()
    const [results] = await con.query(sql, values)
    return results
  }

  // cols?, table, where = null, opts = {}
  async select (...args) {
    // If the first argument is an array (column selection), then offset the
    // argument list by one.
    const argOffset = Array.isArray(args[0]) ? 0 : -1
    const cols = argOffset === 0 ? args[argOffset] : null
    const table = args[argOffset + 1]
    const where = args[argOffset + 2] || null
    // TODO: Handle this according to usage.js
    const opts = args[argOffset + 3] || null

    // console.log({ argOffset, cols, table, where, opts })
    assert.ok(typeof table === 'string', 'Table must be string')

    let sql = 'SELECT'
    const values = []

    // Apply column selection
    if (cols) {
      sql += ' ' + cols.map(c => '`' + c + '`').join(', ')
    } else {
      sql += ' *'
    }

    sql += ' FROM `' + table + '`'

    // TODO: Break this out to separate location since it will be used in
    // updates etc too.
    if (where) {
      sql += ' WHERE ' + Object
        .keys(where)
        .map(k => {
          values.push(where[k])
          return '`' + k + '` = ?'
        })
        .join(' AND ')
    }

    const con = await this._getConnection()
    const driverArgs = [sql]

    // Parameter bindings
    if (values.length) {
      driverArgs.push(values)
    }

    return con.query(...driverArgs)
  }

  // TODO: Construct SQL
  async insert (table, data) {
  }

  // TODO: Construct SQL
  async delete (table, where) {
  }
}

/**
 * Provide all functionality that the common query abstract provides, and add
 * the possibility to start transactions.
 */
class MySQL2Extended extends QueryInterfaceAbstract {
  constructor (driverInstance) {
    super()

    // TODO: Validate instance
    this.driverInstance = driverInstance
  }

  /**
   * Implements QueryInterfaceAbstract._getConnection by using a new connection
   * from the driver every time.
   */
  async _getConnection () {
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
  constructor (con) {
    super()
    this.con = con
  }

  /**
   * Implements QueryInterfaceAbstract._getConnection by reusing one connection
   * since we need to stay in the same in the same connection for the
   * transaction.
   */
  async _getConnection () {
    return this.con
  }

  async commit () {
    return this.con.query('COMMIT')
  }

  async rollback () {
    return this.con.query('ROLLBACK')
  }
}

module.exports = MySQL2Extended
