const PUBLIC_RELATION = /"public"\."([^"]+)"/g;

export function rewriteDemoSql(sql: string, demoTables: ReadonlySet<string>) {
  return sql.replace(PUBLIC_RELATION, (match, name: string) =>
    demoTables.has(name) ? `"demo"."${name}"` : match,
  );
}
