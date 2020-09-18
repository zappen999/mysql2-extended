class MySQL2Mock {
  constructor () {
    this.cons = []
  }

  get openCons () {
    return this.cons.filter(con => !con.isClosed)
  }

  get closedCons () {
    return this.cons.filter(con => con.isClosed)
  }

  async getConnection () {
    const con = new MySQL2MockConnection()
    this.cons.push(con)
    return con
  }
}

class MySQL2MockConnection {
  constructor () {
    this.logs = []
    this.isClosed = false
  }

  async query (...args) {
    this.logs.push(args)
    return Promise.resolve([])
  }

  release () {
    this.isClosed = true
  }
}

module.exports = {
  MySQL2Mock,
  MySQL2MockConnection
}
