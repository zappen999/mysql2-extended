export type DataValue = string | number;
export type BindValue = DataValue;
export type Row = Record<string, any>;
export type Condition<RowT extends Record<string, BindValue>> = {
	[P in keyof RowT]?: BindValue;
};
export type Order = [string, 'asc' | 'desc'];
export type OrderBy = Order | Order[];
export type Opts = {
	offset?: number;
	limit?: number;
	order?: OrderBy;
};

export interface QueryInterface {
	query<RowT extends Row>(sql: string, values?: BindValue[]): Promise<RowT[]>;

	select<RowT extends Row>(
		table: string,
		cond: Condition<RowT> | undefined,
		opts: Opts | undefined,
	): Promise<RowT[]>;

	insert<RowT extends Row>(
		table: string,
		data: RowT | RowT[],
	): Promise<unknown>;

	update<RowT extends Row>(
		table: string,
		data: RowT,
		where?: Condition<RowT>,
		opts?: Opts,
	): Promise<unknown>;

	delete<RowT extends Row>(
		table: string,
		where?: Condition<RowT>,
		opts?: Opts,
	): Promise<unknown>;
}
