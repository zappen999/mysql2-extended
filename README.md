# MySQL2 Extended [WIP]

This is a thin convenience extension for the `mysql2` library. You may want to
use this if:
- You want something more than the raw `query` function provided by `mysql2`.
- You don't want a full-blown ORM.
- You like hand-crafted SQL.

`npm install mysql2-extended`

## Basic usage

See `src/usage.js` for now.

## API reference

TBD

## TODO
- Implement tests where all cases in usage.js are validated.
- Increase performance by not using map/filter/join.

## Future

- Make the library work with more databases.
- Be able to generate SQL queries in specific formats/flavours.
- Support for more complex condition objects.
- Run tests with an actual database connection.
