# MySQL2 Extended
> Thin convenience extension for the `mysql2` library.

You may be interested in this if:
- You want something more than the raw `query` function provided by `mysql2`.
- You don't want a full-blown ORM.
- You like hand-crafted SQL.
- You want typed database results.

<!-- end of the list -->

[![Coverage Status](https://coveralls.io/repos/github/zappen999/mysql2-extended/badge.svg?branch=master)](https://coveralls.io/github/zappen999/mysql2-extended?branch=master)
[![Build Status](https://travis-ci.org/zappen999/mysql2-extended.svg?branch=master)](https://travis-ci.org/zappen999/mysql2-extended)

Installation:

- `npm install mysql2-extended mysql2`
- `yarn add mysql2-extended mysql2`


## Usage

### Setup

```ts
import { MySQL2Extended } from 'mysql2-extended';
import { createPool } from 'mysql2/promise';

const pool = createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'test',
});

const db = new MySQL2Extended(pool);
```

### Typings

Types can be passed to each query function in order to get typed data
back without casting. Note that the types are not validated against the
actual data, but just a convenient way for the developer to add types.

This package provides generic types to help with common workflows. For
example, you probably want types for your tables, like this:


```ts
type User = {
    id: number;                  // Auto increment in MySQL
    email: string;
    firstname: string | null;
    lastname: string | null;
    active: boolean;             // Default 'true' in MySQL column definition
};
```

When creating (inserting) a new user, you don't want to be forced to
provide values for columns that have default values in the database. You
can use the `OptionalDefaultFields` utility type:

```ts
type UserDefaultFields = 'id' | 'firstname' | 'lastname' | 'active';

// CreateUser will only enforce 'email' as required
type CreateUser = OptionalDefaultFields<User, UserDefaultFields>;
```

### Querying

*Note that all supplied parameters will use parameter binding in the
underlying database driver.*

#### Insert

##### Single
```ts
await db.insert<CreateUser>('users', {
    email: 'bob@test.com',
    firstname: 'Bob',
    active: true,
});
```
```sql
INSERT INTO `users` (`email`, `firstname`, `active`) VALUES ('bob@test.com', 'Bob', 1);
```

##### Bulk
```ts
await db.insert<CreateUser>('users', [
    { email: 'bob@test.com' },
    { email: 'another@test.com' },
]);
```
```sql
INSERT INTO `users` (`email`) VALUES ('bob@test.com'), ('another@test.com');
```

---

#### Select

##### Specific columns

```ts
const users = await db.select<Pick<User, 'firstname' | 'lastname'>>(
    ['firstname', 'lastname'],
    'users',
);
```
```sql
SELECT `firstname`, `lastname` FROM `users`;
```

##### All columns
First column argument used above is optional. If no columns are
specified, all columns will be selected:

```ts
const users = await db.select<User>('users');
```
```sql
SELECT * FROM `users`;
```

##### WHERE conditions
Conditions provided in the object will be combined with AND. For more
complex use-cases, see [Raw](#raw) for now.

```ts
const users = await db.select<User>('users', { id: 1, active: true });
```
```sql
SELECT * FROM `users` WHERE `id` = 1 AND `active` = 1;
```

##### Limit and offset
```ts
const users = await db.select<User>(
  'users',
  { id: 1, active: true }, // undefined/null if no conditions are present
  { limit: 10, offset: 5 },
);
```
```sql
SELECT * FROM `users` WHERE `id` = 1 AND `active` = 1 LIMIT 5, 10;
```

##### Ordering
```ts
const users = await db.select<User>(
  'users',
  { id: 1, active: 1 },
  {
    limit: 10,
    offset: 5,
    order: ['id', 'desc'],
    // order: [['firstname', 'desc'], ['lastname', 'asc']],
  },
);
```
```sql
SELECT * FROM `users`
WHERE `id` = 1 AND `active` = 1
ORDER BY `id` DESC
LIMIT 5, 10;
```

---

#### Update

##### All
```ts
await db.update<User>('users', { active: true })
```
```sql
UPDATE `users` SET `active` = 1;
```

##### WHERE conditions
```ts
await db.update('users', { firstname: 'Bob' }, { id: 1 }, { limit: 1 });
```
```sql
UPDATE `users` SET `firstname` = 'Bob' WHERE `id` = 1 LIMIT 1;
```
---

#### Delete

##### All
```ts
await db.delete('users');
```
```sql
DELETE FROM `users`;
```

##### WHERE conditions
```ts
await db.delete<User>('users', { id: 1, active: true });
```
```sql
DELETE FROM `users` WHERE `id` = 1 AND `active` = 1;
```

---

#### Raw

```ts
// Multiple rows
const users = await db.query<{ firstname: string }>('SELECT firstname FROM users LIMIT 2');

// One row
const [user] = await db.query<User>('SELECT * FROM users LIMIT 1');

// Parameter binding
await db.query<User>('SELECT * FROM users LIMIT ?', [1]);
```

---

#### Transactions

##### Managed transaction
A managed transaction will automatically commit if the supplied callback
doesn't throw/reject any error. If the callback throws/rejects, it will
rollback the transaction, and re-throw the error that caused the
rollback.

###### Successful example
```ts
await db.transaction(async t => {
    await t.insert<CreateUser>('users', { email: 'bob@test.com' });
    await t.insert<CreateUser>('users', { email: 'alice@test.com' });
});
```
```sql
BEGIN;
INSERT INTO `users` (`email`) VALUES ('bob@test.com');
INSERT INTO `users` (`email`) VALUES ('alice@test.com');
COMMIT;
```

###### Rollback example
```ts
try {
    await db.transaction(async t => {
        await t.insert<CreateUser>('users', { email: 'bob@test.com' });
        throw new Error('Oops')
        await t.insert<CreateUser>('users', { email: 'alice@test.com' });
    })
} catch (err) {
    // err === Error('Oops')
}
```
```sql
BEGIN;
INSERT INTO `users` (`email`) VALUES ('bob@test.com');
ROLLBACK;
```

##### Manual transactions
```ts
// Manual transaction (user controls commit/rollback)
const transaction = await db.begin();
await transaction.insert<CreateUser>('users', { email: 'bob@test.com' });
await transaction.insert<CreateUser>('users', { email: 'alice@test.com' });
await transaction.commit(); // Or rollback()
```
```sql
BEGIN;
INSERT INTO `users` (`email`) VALUES ('bob@test.com');
INSERT INTO `users` (`email`) VALUES ('alice@test.com');
COMMIT;
```

---

## Future/TODO

- Increase performance by optimizing hot code paths.
- Return affected row count.
- Make the library work with more databases.
- Be able to generate SQL queries in specific formats/flavours.
- Support for more complex condition objects.
- Run tests with an actual database connection.
