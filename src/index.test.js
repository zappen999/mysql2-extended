/* eslint-env jest */
const MySQL2Extended = require('./index')

/**
 * Creates a testable instance of MySQL2Extended.
 */
function createTestInstance () {
  const driverInstance = createMySQLMockInstance()

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
function createMySQLMockInstance () {
  return {
    getConnection: createMockMySQLConnection
  }
}

function createMockMySQLConnection () {
  return {
    query: jest.fn()
  }
}

describe('Initialization', () => {
  test('Should take in a mysql2 instance', () => {
    expect(() => createTestInstance()).not.toThrow()
  })
})

describe('Raw querying', () => {
  test('Should pass query to database driver', () => {
    const { db, driverInstance } = createTestInstance()
    db.query('SELECT * FROM a WHERE id = ?', [1])
    // expect(driverInstance.query.calledWith())
  })
})
