import { MySQL2Extended } from './index';
import { MySQL2Mock } from './mocks/mysql2';
import { QueryBase } from './query-base';

function createTestInstance(): {
	driverInstance: MySQL2Mock;
	db: MySQL2Extended;
} {
	const driverInstance = new MySQL2Mock();

	// Make driver instance available for asserting.
	return {
		db: new MySQL2Extended(driverInstance as any),
		driverInstance,
	};
}

describe('Initialization', () => {
	it('Should take in a mysql2 instance', () => {
		expect(() => createTestInstance()).not.toThrow();
	});
});

describe('Querying', () => {
	describe('Query', () => {
		it('Should pass query to db driver', async () => {
			const { db, driverInstance } = createTestInstance();
			const query = 'SELECT * FROM a WHERE id = ?';
			await db.query(query);
			expect(driverInstance.closedCons.length).toBe(1);
			expect(driverInstance.closedCons[0]?.logs.length).toBe(1);
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(query);
		});

		it('Should pass query to db driver with parameter binding', async () => {
			const { db, driverInstance } = createTestInstance();
			const query = 'SELECT * FROM a WHERE id = ?';
			const values = [1];
			await db.query(query, values);
			expect(driverInstance.closedCons.length).toBe(1);
			expect(driverInstance.closedCons[0]?.logs.length).toBe(1);
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(query);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toBe(values);
		});

		it('should release connection after query', async () => {
			const { db, driverInstance } = createTestInstance();

			await db.query('SELECT * from users');

			expect(driverInstance.openCons.length).toBe(0);
		});
	});

	describe('Select', () => {
		it('Should select all columns if none specified', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'SELECT * FROM `users`';
			await db.select('users');
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should select columns specified', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'SELECT `firstname`, `lastname` FROM `users`';
			await db.select(['firstname', 'lastname'], 'users');
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should select with conditions provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL =
				'SELECT * FROM `users` WHERE `id` = ? AND ' + '`firstname` = ?';
			const expectedValues = [3, 'Test'];
			await db.select('users', { id: 3, firstname: 'Test' });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should select with ordering provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'SELECT * FROM `users` ORDER BY `a` DESC';
			await db.select('users', undefined, { order: ['a', 'desc'] });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should select with multiple orderings provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'SELECT * FROM `users` ORDER BY `a` DESC, `b` ASC';
			await db.select('users', undefined, {
				order: [
					['a', 'desc'],
					['b', 'asc'],
				],
			});
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should select with limit', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'SELECT * FROM `users` LIMIT ?';
			const expectedValues = [3];
			await db.select('users', undefined, { limit: 3 });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should select with limit and offset', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'SELECT * FROM `users` LIMIT ?, ?';
			const expectedValues = [1, 3];
			await db.select('users', undefined, { limit: 3, offset: 1 });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('should release connection after select', async () => {
			const { db, driverInstance } = createTestInstance();

			await db.select('users');

			expect(driverInstance.openCons.length).toBe(0);
		});
	});

	describe('Insert', () => {
		it('Should insert single row', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL =
				'INSERT INTO `users` (`firstname`, `lastname`) ' + 'VALUES (?, ?)';
			const expectedValues = ['Test', 'Testsson'];
			await db.insert('users', { firstname: 'Test', lastname: 'Testsson' });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should insert multiple rows', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL =
				'INSERT INTO `users` (`firstname`, `lastname`) ' +
				'VALUES (?, ?), (?, ?)';
			const expectedValues = ['Test', 'Testsson', 'Try', 'Trysson'];
			await db.insert('users', [
				{ firstname: 'Test', lastname: 'Testsson' },
				{ firstname: 'Try', lastname: 'Trysson' },
			]);
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should throw error if no rows are provided', async () => {
			const { db } = createTestInstance();
			expect.assertions(1);

			try {
				await db.insert('users', []);
			} catch (_err) {
				const err = _err as Error;

				expect(
					err.message.indexOf('There must be atleast one row to insert'),
				).toBeGreaterThan(-1);
			}
		});
	});

	describe('Update', () => {
		it('Should update with conditions provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'UPDATE `users` SET `firstname` = ? WHERE `id` = ?';
			const expectedValues = ['Test', 3];
			await db.update<{ firstname: string; id?: number }>(
				'users',
				{ firstname: 'Test' },
				{ id: 3 },
			);
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should update with ordering provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL =
				'UPDATE `users` SET `firstname` = ? ORDER BY `a` DESC';
			await db.update('users', { firstname: 'Test' }, undefined, {
				order: ['a', 'desc'],
			});
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should update with multiple orderings provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL =
				'UPDATE `users` SET `firstname` = ? ' + 'ORDER BY `a` DESC, `b` ASC';
			await db.update('users', { firstname: 'Test' }, undefined, {
				order: [
					['a', 'desc'],
					['b', 'asc'],
				],
			});
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should update with limit', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'UPDATE `users` SET `firstname` = ? LIMIT ?';
			const expectedValues = ['Test', 3];
			await db.update('users', { firstname: 'Test' }, undefined, { limit: 3 });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should not respect limit with offset', async () => {
			expect.assertions(1);
			const { db } = createTestInstance();

			try {
				await db.update('users', { firstname: 'Test' }, undefined, {
					limit: 3,
					offset: 1,
				});
			} catch (_err) {
				const err = _err as Error;

				expect(
					err.message.indexOf('offset not supported on updates using MySQL'),
				).toBeGreaterThan(-1);
			}
		});
	});

	describe('Delete', () => {
		it('Should delete with conditions provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'DELETE FROM `users` WHERE `id` = ?';
			const expectedValues = [3];
			await db.delete('users', { id: 3 });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should delete with ordering provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'DELETE FROM `users` ORDER BY `a` DESC';
			await db.delete('users', undefined, { order: ['a', 'desc'] });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should delete with multiple orderings provided', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'DELETE FROM `users` ORDER BY `a` DESC, `b` ASC';
			await db.delete('users', undefined, {
				order: [
					['a', 'desc'],
					['b', 'asc'],
				],
			});
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
		});

		it('Should delete with limit', async () => {
			const { db, driverInstance } = createTestInstance();
			const expectedSQL = 'DELETE FROM `users` LIMIT ?';
			const expectedValues = [3];
			await db.delete('users', undefined, { limit: 3 });
			expect(driverInstance.closedCons[0]?.logs[0][0]).toBe(expectedSQL);
			expect(driverInstance.closedCons[0]?.logs[0][1]).toEqual(expectedValues);
		});

		it('Should not respect limit with offset', async () => {
			expect.assertions(1);
			const { db } = createTestInstance();

			try {
				await db.delete('users', undefined, { limit: 3, offset: 1 });
			} catch (_err) {
				const err = _err as Error;

				expect(
					err.message.indexOf('offset not supported on deletes using MySQL'),
				).toBeGreaterThan(-1);
			}
		});
	});

	describe('Transaction', () => {
		describe('Begin', () => {
			it('Should return a query interface', async () => {
				const { db } = createTestInstance();
				const transaction = await db.begin();
				expect(transaction instanceof QueryBase).toEqual(true);
			});

			it('Should open a new connection and reuse it', async () => {
				const { db, driverInstance } = createTestInstance();

				const transaction = await db.begin();
				await transaction.select('users');
				await transaction.commit();

				expect(driverInstance.closedCons.length).toBe(1);
				const queries = driverInstance.closedCons[0]?.logs;
				expect(queries![0][0]).toEqual('BEGIN');
				expect(queries![1][0]).toEqual('SELECT * FROM `users`');
				expect(queries![2][0]).toEqual('COMMIT');
			});
		});

		it('should release connections after commit', async () => {
			const { db, driverInstance } = createTestInstance();

			const transaction = await db.begin();
			await transaction.select('users');
			await transaction.commit();

			expect(driverInstance.openCons.length).toBe(0);
		});

		it('should release connections after rollback', async () => {
			const { db, driverInstance } = createTestInstance();

			const transaction = await db.begin();
			await transaction.select('users');
			await transaction.rollback();

			expect(driverInstance.openCons.length).toBe(0);
		});

		it('Should throw if committing twice', async () => {
			expect.assertions(1);
			const { db } = createTestInstance();

			const transaction = await db.begin();
			await transaction.commit(); // first

			try {
				await transaction.commit(); // second
			} catch (err) {
				expect(err).toEqual(
					new Error('Cannot COMMIT transaction. Already got COMMIT'),
				);
			}
		});

		it('Should throw if doing rollback twice', async () => {
			expect.assertions(1);
			const { db } = createTestInstance();

			const transaction = await db.begin();
			await transaction.rollback(); // first

			try {
				await transaction.rollback(); // second
			} catch (err) {
				expect(err).toEqual(
					new Error('Cannot ROLLBACK transaction. Already got ROLLBACK'),
				);
			}
		});

		it('Should throw if doing rollback after commit', async () => {
			expect.assertions(1);
			const { db } = createTestInstance();

			const transaction = await db.begin();
			await transaction.commit();

			try {
				await transaction.rollback();
			} catch (err) {
				expect(err).toEqual(
					new Error('Cannot ROLLBACK transaction. Already got COMMIT'),
				);
			}
		});
	});

	describe('Managed transaction', () => {
		it('Should rollback transaction if user callback throws', async () => {
			expect.assertions(5);
			const { db, driverInstance } = createTestInstance();

			try {
				await db.transaction(async (transaction) => {
					await transaction.select('users');
					throw new Error('Oopsy');
				});
			} catch (err) {
				expect(err).toEqual(new Error('Oopsy'));
			}

			expect(driverInstance.closedCons.length).toBe(1);
			const queries = driverInstance.closedCons[0]?.logs;
			expect(queries![0][0]).toEqual('BEGIN');
			expect(queries![1][0]).toEqual('SELECT * FROM `users`');
			expect(queries![2][0]).toEqual('ROLLBACK');
		});

		it('Should auto commit transaction', async () => {
			expect.assertions(4);
			const { db, driverInstance } = createTestInstance();

			await db.transaction(async (transaction) => {
				await transaction.select('users');
			});

			expect(driverInstance.closedCons.length).toBe(1);
			const queries = driverInstance.closedCons[0]?.logs;
			expect(queries![0][0]).toEqual('BEGIN');
			expect(queries![1][0]).toEqual('SELECT * FROM `users`');
			expect(queries![2][0]).toEqual('COMMIT');
		});
	});
});
