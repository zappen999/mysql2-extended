import type { Connection, PoolConnection } from 'mysql2/promise';

import type { MySQL2Extended } from './index';
export type DataValue = string | number | null;
export type BindValue = DataValue | DataValue[];
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

export type SingleConnection = Connection | PoolConnection;

export interface QueryInterface {
	query<RowT extends Row>(sql: string, values?: BindValue[]): Promise<RowT[]>;
	queryOne<RowT extends Row>(sql: string, values?: BindValue[]): Promise<RowT>;

	select<RowT extends Row>(
		table: string,
		cond: Condition<RowT> | undefined,
		opts: Opts | undefined,
	): Promise<RowT[]>;

	selectOne<RowT extends Row>(
		table: string,
		cond: Condition<RowT> | undefined,
		opts: Opts | undefined,
	): Promise<RowT>;

	insert<RowT extends Row>(
		table: string,
		data: RowT | RowT[],
	): Promise<unknown>;

	update<RowT extends Row>(
		table: string,
		data: Partial<RowT>,
		where?: Condition<RowT>,
		opts?: Opts,
	): Promise<unknown>;

	delete<RowT extends Row>(
		table: string,
		where?: Condition<RowT>,
		opts?: Opts,
	): Promise<unknown>;
}

// Convenience types:

export type OptionalDefaultFields<
	TableT,
	DefaultFieldsT extends keyof TableT,
> = Omit<TableT, DefaultFieldsT> & Partial<Pick<TableT, DefaultFieldsT>>;

export type Con = QueryInterface;
export type Db = MySQL2Extended;
