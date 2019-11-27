const MySQL2Extended = require('./index');
const mysql2 = require('mysql2/promise');

const pool = mysql2.createPool({
	host: '127.0.0.1',
	user: 'root',
	password: 'password',
	database: 'test',
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 10,
})

const db = new MySQL2Extended(pool)

async function test() {
	// Fetch multiple rows
	const users = await db.query('SELECT firstname FROM users LIMIT 2');

	// Fetch one row
	const [user] = await db.query('SELECT * FROM users LIMIT 1')

	// Transaction (manual)
	const con = await db.begin()
	await con.query('select firstname from users limit 1')
	await con.query('select firstname from users limit 2')
	await con.commit()
	// await con.insert('users', { firstname: 'Johan' })
	// await con.insert('users', { firstname: 'Rickard' })

	// Transaction (managed)
	// await db.transaction(async con => {
	// 	await con.query(`insert into users (firstname) values ('johan')`)
	// 	await con.query('select * from users limit 1')
	// })

	// Parameter binding
	const [user2] = await db.query('select email from users where id = ?', [20322])
	console.log(user2)


	process.exit(0)
}

test().catch(err => console.log(err))


// // Select using convenience function
// const [user] = await db.select(['firstname', 'lastname'], 'users', { id: 5 })

// // Select all columns using convenience function
// const users = await db.select('users', { id: 5 })

// // Select with condition, limit, offset and order
// const users = await db.select(
// 	['firstname'],
// 	'users',
// 	{ id: 5 },
// 	{
// 		limit: 10,
// 		offset: 3,
// 		order: [
// 			['id', 'desc'],
// 			['gender', 'asc']
// 		]
// 	}
// )

// // Parameter binding
// const [user] = await db.query('SELECT * FROM users WHERE id = ?', 5)
// const users = await db.query('SELECT * FROM users WHERE id IN(?, ?)', 5, 6)

// // Insert one record into table with convenience function
// await db.insert('users', { firstname: 'Johan' })

// // Insert multiple records into table with convenience function
// await db.insert('users', [
// 	{ firstname: 'Johan' },
// 	{ firstname: 'Rickard' },
// ])

// // Update with convenience function
// await db.update('users', { firstname: 'Johan' }, { id: 1 });

// // Delete with convenience function
// const deleteCount = await db.delete('users', { id: 5 })

// // Joins
// const users = await db.query(`
// 	SELECT
// 		u.firstname,
// 		p.name
// 	FROM users u
// 	INNER JOIN platforms p ON u.platform_id = p.id
// 	WHERE u.id = ?
// `, 5)

// // Extra requirements:
// // - Affected rows when using query()
