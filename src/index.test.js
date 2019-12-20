/* eslint-env jest */
const MySQL2Extended = require('./index')

/**
 * Creates a testable instance of MySQL2Extended.
 */
function createTestInstance () {
  const driverInstance = new MySQL2Mock()

  // Make driver instance available for asserting.
  return {
    db: new MySQL2Extended(driverInstance),
    driverInstance
  }
}

// TODO: BREAK MYSQL SPECIFIC STUFF OUT TO OTHER MODULE

/**
 * Create mock instance of mysql2.
 */
class MySQL2Mock {
  constructor () {
    // List of opened connections with this instance.
    this.connections = []
  }

  async getConnection () {
    const con = new MySQL2MockConnection()
    this.connections.push(con)
    return con
  }
}

class MySQL2MockConnection {
  constructor () {
    this.logs = []
  }

  async query (...args) {
    this.logs.push(args)
    return Promise.resolve([])
  }
}

describe('Initialization', () => {
  test('Should take in a mysql2 instance', () => {
    expect(() => createTestInstance()).not.toThrow()
  })
})

describe('Querying', () => {
  describe('Query', () => {
    test('Should pass query to db driver', async () => {
      const { db, driverInstance } = createTestInstance()
      const query = 'SELECT * FROM a WHERE id = ?'
      await db.query(query)
      expect(driverInstance.connections.length).toBe(1)
      expect(driverInstance.connections[0].logs.length).toBe(1)
      expect(driverInstance.connections[0].logs[0][0]).toBe(query)
    })

    test('Should pass query to db driver with parameter binding', async () => {
      const { db, driverInstance } = createTestInstance()
      const query = 'SELECT * FROM a WHERE id = ?'
      const values = [1]
      await db.query(query, values)
      expect(driverInstance.connections.length).toBe(1)
      expect(driverInstance.connections[0].logs.length).toBe(1)
      expect(driverInstance.connections[0].logs[0][0]).toBe(query)
      expect(driverInstance.connections[0].logs[0][1]).toBe(values)
    })
  })

  describe('Select', () => {
    test('Should select all columns if none specified', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'SELECT * FROM `users`'
      await db.select('users')
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
    })

    test('Should select columns specified', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'SELECT `firstname`, `lastname` FROM `users`'
      await db.select(['firstname', 'lastname'], 'users')
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
    })

    test('Should select with conditions provided', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'SELECT * FROM `users` WHERE `id` = ?'
      const expectedValues = [3]
      await db.select('users', { id: 3 })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })

    test('Should select with ordering provided', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'SELECT * FROM `users` ORDER BY `a` DESC'
      await db.select('users', null, { order: ['a', 'desc'] })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
    })

    test('Should select with multiple orderings provided', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'SELECT * FROM `users` ORDER BY `a` DESC, `b` ASC'
      await db.select('users', null, { order: [['a', 'desc'], ['b', 'asc']] })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
    })

    test('Should select with limit', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'SELECT * FROM `users` LIMIT ?'
      const expectedValues = [3]
      await db.select('users', null, { limit: 3 })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })

    test('Should select with limit and offset', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'SELECT * FROM `users` LIMIT ?, ?'
      const expectedValues = [1, 3]
      await db.select('users', null, { limit: 3, offset: 1 })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })
  })

  describe('Insert', () => {
    test('Should insert single row', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'INSERT INTO `users` (`firstname`, `lastname`) ' +
        'VALUES (?, ?)'
      const expectedValues = ['Test', 'Testsson']
      await db.insert('users', { firstname: 'Test', lastname: 'Testsson' })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })

    test('Should insert multiple rows', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'INSERT INTO `users` (`firstname`, `lastname`) ' +
        'VALUES (?, ?), (?, ?)'
      const expectedValues = ['Test', 'Testsson', 'Try', 'Trysson']
      await db.insert('users', [
        { firstname: 'Test', lastname: 'Testsson' },
        { firstname: 'Try', lastname: 'Trysson' }
      ])
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })

    test('Should throw error if no rows are provided', async () => {
      const { db } = createTestInstance()
      expect.assertions(1)

      try {
        await db.insert('users', [])
      } catch (err) {
        expect(
          err.message.indexOf('There must be atleast one row to insert')
        ).toBeGreaterThan(-1)
      }
    })
  })

  describe('Delete', () => {
    test('Should delete with conditions provided', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'DELETE FROM `users` WHERE `id` = ?'
      const expectedValues = [3]
      await db.delete('users', { id: 3 })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })

    test('Should delete with ordering provided', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'DELETE FROM `users` ORDER BY `a` DESC'
      await db.delete('users', null, { order: ['a', 'desc'] })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
    })

    test('Should delete with multiple orderings provided', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'DELETE FROM `users` ORDER BY `a` DESC, `b` ASC'
      await db.delete('users', null, { order: [['a', 'desc'], ['b', 'asc']] })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
    })

    test('Should delete with limit', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'DELETE FROM `users` LIMIT ?'
      const expectedValues = [3]
      await db.delete('users', null, { limit: 3 })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })

    test('Should not respect limit with offset', async () => {
      const { db, driverInstance } = createTestInstance()
      const expectedSQL = 'DELETE FROM `users` LIMIT ?'
      const expectedValues = [3]
      await db.delete('users', null, { limit: 3, offset: 1 })
      expect(driverInstance.connections[0].logs[0][0]).toBe(expectedSQL)
      expect(driverInstance.connections[0].logs[0][1]).toEqual(expectedValues)
    })
  })
})
