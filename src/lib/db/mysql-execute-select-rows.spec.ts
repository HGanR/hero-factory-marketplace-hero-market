/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { rowsFromMysqlExecute } from "@/lib/db/mysql-execute-select-rows";

describe("rowsFromMysqlExecute", () => {
  it("extracts rows from mysql2 [rows, fields] tuple", () => {
    const rows = [{ id: "1" }];
    expect(rowsFromMysqlExecute([rows, []])).toEqual([{ id: "1" }]);
  });

  it("passes through flat row array", () => {
    expect(rowsFromMysqlExecute([{ a: 1 }])).toEqual([{ a: 1 }]);
  });

  it("returns empty for non-array", () => {
    expect(rowsFromMysqlExecute(null)).toEqual([]);
  });
});
