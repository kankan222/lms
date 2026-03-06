import { pool } from "../../database/pool.js";

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}