export class MySQL2Mock {
	protected cons: MySQL2MockConnection[] = [];

	get openCons(): MySQL2MockConnection[] {
		return this.cons.filter((con) => !con.isClosed);
	}

	get closedCons(): MySQL2MockConnection[] {
		return this.cons.filter((con) => con.isClosed);
	}

	async getConnection(): Promise<MySQL2MockConnection> {
		const con = new MySQL2MockConnection();
		this.cons.push(con);
		return con;
	}
}

export class MySQL2MockConnection {
	public logs: any[] = [];
	public isClosed = false;

	async query(...args: any): Promise<any> {
		this.logs.push(args);
		return Promise.resolve([]);
	}

	release() {
		this.isClosed = true;
	}
}
