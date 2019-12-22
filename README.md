# MySQL2 Extended
> Thin convenience extension for the `mysql2` library.

You may be interested in this if:
- You want something more than the raw `query` function provided by `mysql2`.
- You don't want a full-blown ORM.
- You like hand-crafted SQL.

`npm install mysql2-extended`

[![Coverage Status](https://coveralls.io/repos/github/zappen999/mysql2-extended/badge.svg?branch=master)](https://coveralls.io/github/zappen999/mysql2-extended?branch=master)
[![Build Status](https://travis-ci.org/zappen999/mysql2-extended.svg?branch=master)](https://travis-ci.org/zappen999/mysql2-extended)

## Usage

### Setup

```js
const MySQL2Extended = require('mysql2-extended')
const mysql2 = require('mysql2/promise')

const pool = mysql2.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'test'
})

const db = new MySQL2Extended(pool)
```

### Querying

*Note that all supplied parameters will use parameter binding in the underlying
database driver.*

#### Select

##### Specific columns
```js
const users = await db.select(['firstname', 'lastname'], 'users')
```
```sql
SELECT `firstname`, `lastname` FROM `users`;
```
##### All columns
First column argument used above is optional. If no columns are specified, all
columns will be selected:

```js
const users = await db.select('users')
```
```sql
SELECT * FROM `users`;
```

##### WHERE conditions
Conditions provided in the object will be combined with AND. For more complex
use-cases, see [Raw](#raw) for now.

```js
const users = await db.select('users', { id: 1, active: 1 })
```
```sql
SELECT * FROM `users` WHERE `id` = 1 AND `active` = 1;
```

##### Limit and offset
```js
const users = await db.select(
  'users',
  { id: 1, active: 1 }, // undefined/null if no conditions are present
  { limit: 10, offset: 5 }
)
```
```sql
SELECT * FROM `users` WHERE `id` = 1 AND `active` = 1 LIMIT 5, 10;
```

##### Ordering
```js
const users = await db.select(
  'users',
  { id: 1, active: 1 },
  {
    limit: 10,
    offset: 5,
    order: ['id', 'desc']
    // order: [['firstname', 'desc'], ['lastname', 'asc']]
  },
)
```
```sql
SELECT * FROM `users`
WHERE `id` = 1 AND `active` = 1
ORDER BY `id` DESC
LIMIT 5, 10;
```

---

#### Insert

##### Single
```js
await db.insert('users', { firstname: 'Bob', active: 1 })
```
```sql
INSERT INTO `users` (`firstname`, `active`) VALUES ('Bob', 1);
```

##### Bulk
```js
await db.insert('users', [
    { firstname: 'Bob' },
    { firstname: 'Another' }
])
```
```sql
INSERT INTO `users` (`firstname`) VALUES ('Bob'), ('Another');
```

---

#### Update

##### All
```js
await db.update('users', { active: 1 })
```
```sql
UPDATE `users` SET `active` = 1;
```

##### WHERE conditions
```js
await db.update('users', { firstname: 'Bob' }, { id: 1 }, { limit: 1 })
```
```sql
UPDATE `users` SET `firstname` = 'Bob' WHERE `id` = 1 LIMIT 1;
```
---

#### Delete

##### All
```js
await db.delete('users')
```
```sql
DELETE FROM `users`;
```

##### WHERE conditions
```js
await db.delete('users', { id: 1, active: 1 })
```
```sql
DELETE FROM `users` WHERE `id` = 1 AND `active` = 1;
```

---

#### Raw

```js
// Multiple rows
const users = await db.query('SELECT firstname FROM users LIMIT 2')

// One row
const [user] = await db.query('SELECT * FROM users LIMIT 1')

// Parameter binding
await db.query('SELECT * FROM users LIMIT ?', [1])
```

---

#### Transactions

##### Managed transaction
A managed transaction will automatically commit if the supplied callback doesn't
throw/reject any error. If the callback throws/rejects, it will rollback the
transaction, and re-throw the error that caused the rollback.

###### Successful example
```js
await db.transaction(async transaction => {
  await transaction.insert('users', { firstname: 'Bob' })
  await transaction.insert('users', { firstname: 'Alice' })
})
```
```sql
BEGIN;
INSERT INTO `users` (`firstname`) VALUES ('Bob');
INSERT INTO `users` (`firstname`) VALUES ('Alice');
COMMIT;
```

###### Rollback example
```js
try {
  await db.transaction(async transaction => {
    await transaction.insert('users', { firstname: 'Bob' })
    throw new Error('Oops')
    await transaction.insert('users', { firstname: 'Alice' })
  })
} catch (err) {
  // err === Error('Oops')
}
```
```sql
BEGIN;
INSERT INTO `users` (`firstname`) VALUES ('Bob');
ROLLBACK;
```


##### Manual transactions
```js
// Manual transaction (user controls commit/rollback)
const transaction = await db.begin()
await transaction.insert('users', { firstname: 'Bob' })
await transaction.insert('users', { firstname: 'Alice' })
await transaction.commit() // Or rollback()
```
```sql
BEGIN;
INSERT INTO `users` (`firstname`) VALUES ('Bob');
INSERT INTO `users` (`firstname`) VALUES ('Alice');
COMMIT;
```

---

## API

*Note that while the following typings are based on TypeScript syntax, they are
for demonstration purposes, and will not be functioning in an TS application.*

```ts
interface MySQL2Extended extends QueryInterfaceAbstract {
  begin(): Promise<TransactionContext>
  transaction((transaction: TransactionContext) => Promise<any>): Promise<any>
}

interface TransactionContext extends QueryInterfaceAbstract  {
  commit(): Promise<any>
  rollback(): Promise<void>
}

interface QueryInterfaceAbstract {
  constructor(mysql2: MySQL2Instance): MySQL2Extended

  select(
    table: string
    conditions?: Conditions
    opts?: Opts
  ): Promise<Array<Object>>

  select(
    columns: string[],
    table: string,
    conditions?: Conditions
    opts?: SelectOpts
  ): Promise<Array<Object>>

  insert(table: string, data: {[column: string]: any}): Promise<void>

  update(
    table: string
    data: {[column: string]: any}
    conditions?: Conditions
    opts?: Opts
  ): Promise<void>

  delete(
    table: string
    conditions?: Conditions
    opts?: Opts
  ): Promise<void>
}

interface Conditions {
  [column: string]: any
}

interface Opts {
  limit?: number
  order?: [string, 'asc' | 'desc']
  // or array of sorting tuples
  // order?: Array<[string, 'asc' | 'desc']>
}

interface SelectOpts extends Opts {
  offset?: number
}
```

## TODO
- Increase performance by optimizing hot code paths.
- Return affected row count.

## Future

- Make the library work with more databases.
- Be able to generate SQL queries in specific formats/flavours.
- Support for more complex condition objects.
- Run tests with an actual database connection.
