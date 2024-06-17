export type MySQL2MockOpts = {
	connectionOpts?: MySQL2MockConnectionOpts
};

export class MySQL2Mock {
	constructor(protected opts?: MySQL2MockOpts) {}

	protected cons: MySQL2MockConnection[] = [];

	get openCons(): MySQL2MockConnection[] {
		return this.cons.filter((con) => !con.isClosed);
	}

	get closedCons(): MySQL2MockConnection[] {
		return this.cons.filter((con) => con.isClosed);
	}

	async getConnection(): Promise<MySQL2MockConnection> {
		const con = new MySQL2MockConnection(this.opts?.connectionOpts);
		this.cons.push(con);
		return con;
	}
}

export type MySQL2MockConnectionOpts = {
	queryResult?: unknown[]
}

export class MySQL2MockConnection {
	constructor(protected opts?: MySQL2MockConnectionOpts) { }

	public logs: any[] = [];
	public isClosed = false;

	async query(...args: any): Promise<any> {
		this.logs.push(args);
		return Promise.resolve(this.opts?.queryResult || []);
	}

	release() {
		this.isClosed = true;
	}
}
