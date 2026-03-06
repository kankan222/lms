import mysql from "mysql2/promise";
import { dbConfig } from "../config/database.js";

export const pool = mysql.createPool(dbConfig);