export function testDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value)
    throw Error(
      "Set TEST_DATABASE_URL to a disposable local PostgreSQL database.",
    );
  const u = new URL(value);
  if (
    !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(u.hostname) ||
    !u.pathname.endsWith("_test")
  ) {
    throw Error(
      "Database tests require a local/CI database whose name ends in _test. Never use the salon database.",
    );
  }
  return value;
}
