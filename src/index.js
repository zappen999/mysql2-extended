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

  /**
   * Arguments: cols (optional), table, where = null, opts = {}
   * TODO: See common operations that can be shared in select/update/delete.
   */
  async select (...args) {
    // If the first argument is an array (column selection), then offset the
    // argument list by one.
    const argOffset = Array.isArray(args[0]) ? 0 : -1
    const cols = argOffset === 0 ? args[argOffset] : null
    const table = args[argOffset + 1]
    const condObj = args[argOffset + 2] || null
    // TODO: Handle this according to usage.js
    const opts = args[argOffset + 3] || {}

    // console.log({ argOffset, cols, table, condObj, opts })
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

    if (condObj) {
      sql += this._getWhereCondition(condObj, values)
    }

    if (opts.order) {
      sql += this._applyOrder(opts.order)
    }

    if (opts.limit) {
      sql += this._applyLimit(values, opts.limit, opts.offset)
    }

    const con = await this._getConnection()
    const driverArgs = [sql]

    // Parameter bindings
    if (values.length) {
      driverArgs.push(values)
    }

    return con.query(...driverArgs)
  }

  /**
   * Construct condition (WHERE clause) from condition object. Note that this
   * will mutate the values array by adding bound parameters to it.
   */
  _getWhereCondition (condObj, values) {
    return ' WHERE ' + Object
      .keys(condObj)
      .map(k => {
        values.push(condObj[k])
        return '`' + k + '` = ?'
      })
      .join(' AND ')
  }

  /**
   * Applies order to select(?) query.
   * TODO: Assertion on DESC/ASC?
   */
  _applyOrder (order) {
    assert.ok(Array.isArray(order), 'opts.order must be an array')

    // Wrap single order array to be able to handle it in the same way
    const orderings = !Array.isArray(order[0])
      ? [order]
      : order

    return ' ORDER BY ' + orderings
      .map(o => '`' + o[0] + '` ' + o[1].toUpperCase())
      .join(', ')
  }

  /**
   * Constructs limit clause. Note that this will mutate the values array by
   * adding the limit/offset values as bound parameter values.
   */
  _applyLimit (values, limit, offset = null) {
    let sql = ''

    if (offset) {
      sql += ' LIMIT ?, ?'
      values.push(offset, limit)
    } else {
      sql = ' LIMIT ?'
      values.push(limit)
    }

    return sql
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
