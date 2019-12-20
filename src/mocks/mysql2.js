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

module.exports = {
  MySQL2Mock,
  MySQL2MockConnection
}
