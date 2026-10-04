import { customType } from 'drizzle-orm/pg-core';

/** Column types drizzle doesn't ship. Not tables, so not owned by any module. */

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});
