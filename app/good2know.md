# Prisma P1013 Error: Invalid Database String due to Newlines in .env.local

## Problem
When running Prisma migrations (e.g., `npm run db:migrate`), you might encounter the following error:

```
Error: P1013: The provided database string is invalid. invalid domain character in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
```

This error indicates that the database connection URL, typically sourced from an environment variable like `DATABASE_URL` in your `.env.local` file, contains invalid characters. A common cause is accidental line breaks within the environment variable's value.

## Cause
This specific instance of the `P1013` error was traced to environment variables in `.env.local` being split across multiple lines. This can happen during copy-pasting from a terminal that wraps long lines, effectively inserting newline characters into the variable's value.

For example, `cat -e .env.local` might reveal something like this:

```
DATABASE_URL="postgresql://user:pass@host.e
xample.com/db?sslmode=require"$
```

Where `.e` is at the end of one line and `xample.com` starts the next, breaking the URL.

## Solution
To resolve this, you need to edit your `.env.local` file and ensure that each environment variable definition, especially long URLs or tokens, is on a single continuous line.

1.  **Identify the broken lines:** Use `cat -e .env.local` to inspect your `.env.local` file for unintended `$ ` (end-of-line markers) in the middle of a variable's value.
2.  **Edit the file:** Manually remove any newline characters within the quoted string values of your environment variables. Ensure the entire value for each variable is on one line.

    **Before (incorrect):**
    ```
    DATABASE_URL="postgresql://user:password@ep-proud-resonance-abunyz7r-pooler.e
    u-west-2.aws.neon.tech/neondb?sslmode=require"
    ```

    **After (correct):**
    ```
    DATABASE_URL="postgresql://user:password@ep-proud-resonance-abunyz7r-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    ```

After correcting the `.env.local` file, re-run your Prisma migration command (`npm run db:migrate`). It should now execute successfully.