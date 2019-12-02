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
    // // Select using convenience function
    // const [user] = await db.select(['firstname', 'lastname'], 'users', { id: 5 })

    // // Select all columns using convenience function
    // const users = await db.select('users', { id: 5 })

    // // Select with condition, limit, offset and order
    // const users = await db.select(
    //   ['firstname'],
    //   'users',
    //   { id: 5 },
    //   {
    //     limit: 10,
    //     offset: 3,
    //     order: [
    //       ['id', 'desc'],
    //       ['gender', 'asc']
    //     ]
    // }
    // )

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
  })
})
