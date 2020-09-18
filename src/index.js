const { QueryInterfaceAbstract } = require('./query-abstract')

/**
 * Provide all functionality that the common query abstract provides, and add
 * the possibility to start transactions.
 */
class MySQL2Extended extends QueryInterfaceAbstract {
  constructor (driverInstance, isPool = true) {
    super()
    this.driverInstance = driverInstance
    this.isPool = isPool
  }

  /**
   * Implements QueryInterfaceAbstract._getConnection by using a new connection
   * from the driver every time.
   */
  async _getConnection () {
    return this.driverInstance.getConnection()
  }

  async _closeConnection (con) {
    if (this.isPool) {
      con.release()
    }
  }

  // Fetches a connection from the driver and creates a transaction context
  async begin () {
    const con = await this._getConnection()
    const transactionContext = new TransactionContext(
      con,
      this.isPool
    )
    await transactionContext._begin()
    return transactionContext
  }

  // Managed transaction (auto rollback)
  async transaction (callback) {
    const transaction = await this.begin()

    try {
      await callback(transaction)
      await transaction.commit()
    } catch (err) {
      // Error somewhere in the user code, roll back and throw
      // TODO: What error should we throw if this rollback fails?
      await transaction.rollback()
      throw err
    }
  }
}

class TransactionContext extends QueryInterfaceAbstract {
  constructor (con, isPool) {
    super()
    this.con = con
    this.isPool = isPool
    this.lastAction = null
  }

  /**
   * Implements QueryInterfaceAbstract._getConnection by reusing one connection
   * since we need to stay in the same in the same connection for the
   * transaction.
   */
  async _getConnection () {
    return this.con
  }

  async _closeConnection (con) {
    if (this.isPool) {
      con.release(con)
    }
  }

  async _begin () {
    return this.con.query('BEGIN')
  }

  async commit () {
    this._validateCleanAndMarkDirty('COMMIT')
    return this.con.query('COMMIT')
  }

  async rollback () {
    this._validateCleanAndMarkDirty('ROLLBACK')
    return this.con.query('ROLLBACK')
  }

  _validateCleanAndMarkDirty (action) {
    if (!this.lastAction) {
      this.lastAction = action
      return
    }

    throw new Error(
      `Cannot ${action} transaction. Already got ${this.lastAction}`
    )
  }
}

module.exports = MySQL2Extended
