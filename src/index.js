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

    assert.ok(typeof table === 'string', 'Table must be string')

    let sql = 'SELECT'
    const values = []

    // Apply column selection
    if (cols) {
      sql += ' ' + cols.map(c => this._strWrap(c, '`')).join(', ')
    } else {
      sql += ' *'
    }

    sql += ' FROM ' + this._strWrap(table, '`')

    if (condObj) {
      sql += this._applyWhereCondition(condObj, values)
    }

    if (opts.order) {
      sql += this._applyOrder(opts.order)
    }

    if (opts.limit) {
      sql += this._applyLimit(values, opts.limit, opts.offset)
    }

    return this._execute(sql, values)
  }

  /**
   * Construct condition (WHERE clause) from condition object. Note that this
   * will mutate the values array by adding bound parameters to it.
   */
  _applyWhereCondition (condObj, values) {
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
      .map(o => this._strWrap(o[0], '`') + ' ' + o[1].toUpperCase())
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

  /**
   * Insert. Data can be either a single object, or an array of uniform objects.
   */
  async insert (table, data) {
    assert.ok(typeof table === 'string', 'Table must be string')

    let sql = `INSERT INTO ${this._strWrap(table, '`')}`
    const values = []

    // Wrap single data object into array to be able to handle both bulk an
    // normal insertions in the same way.
    const rows = !Array.isArray(data)
      ? [data]
      : data
    assert.ok(rows.length > 0, 'There must be atleast one row to insert.')

    const firstRow = rows[0]
    const firstRowKeys = Object.keys(firstRow)
    const valuePlaceholder = '(' + firstRowKeys.map(_ => '?').join(', ') + ')'

    // Append the columns that will be updated based on the first object.
    sql += ' ('
    sql += firstRowKeys
      .map(k => this._strWrap(k, '`'))
      .join(', ')
    sql += ') VALUES '

    sql += rows
      .map(row => {
        values.push(...Object.values(row))
        return valuePlaceholder
      })
      .join(', ')

    return this._execute(sql, values)
  }

  /**
   * Delete. Note that opts.offset will not be respected in the same way as
   * insert, since MySQL does not support delete's with offset.
   */
  async delete (table, condObj = null, opts = {}) {
    assert.ok(typeof table === 'string', 'Table must be string')

    let sql = 'DELETE'
    const values = []

    sql += ' FROM ' + this._strWrap(table, '`')

    if (condObj) {
      sql += this._applyWhereCondition(condObj, values)
    }

    if (opts.order) {
      sql += this._applyOrder(opts.order)
    }

    if (opts.limit) {
      sql += this._applyLimit(values, opts.limit)
    }

    return this._execute(sql, values)
  }

  _strWrap (str, char) {
    return `${char}${str}${char}`
  }

  async _execute (sql, values = []) {
    const con = await this._getConnection()
    const driverArgs = [sql]

    // Parameter bindings
    if (values.length) {
      driverArgs.push(values)
    }

    return con.query(...driverArgs)
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
