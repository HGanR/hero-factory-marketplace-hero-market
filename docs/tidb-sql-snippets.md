# TiDB Cloud — SQL snippets

Use **any** SQL editor tab in the TiDB Cloud console for your cluster. **New tab vs same tab does not matter** — only the **database** you run `USE` against.

**Rule:** paste **only** SQL statements. Do **not** paste file paths like `drizzle/foo.sql`.

---

## `ret_sessions` table (RET widget / autosave)

1. Open **SQL Editor** → connect to your project/cluster.
2. Optional: select database `hero-market` (or run `USE` below).
3. Paste and run:

```sql
USE `hero-market`;

CREATE TABLE IF NOT EXISTS `ret_sessions` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `draftJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ret_sessions_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

If you get **“table already exists”**, the migration is already applied.

**If `DESCRIBE ret_sessions` says the table doesn’t exist:** the `CREATE TABLE` likely failed. Common mistake: an **extra `);`** after the closing `ENGINE=InnoDB...` line — the statement must end **once** with `;`, not `);` twice.

---

## Same tab or new tab?

- **Same tab:** fine — clear the editor first if it still contains old statements you do not want to run again.
- **New tab:** fine — avoids accidentally re-running a long script.

What matters is **`USE \`your-database\`;`** pointing at the correct database before `CREATE TABLE`.
