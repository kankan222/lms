import { pool } from "../../database/pool.js";
import * as repo from "./fee.repository.js";
import { notify}
  from "../notifications/notification.service.js";

export async function runFeeReminder(){

  const conn = await pool.getConnection();

  try{
    await conn.beginTransaction();

    const overdue =
      await repo.getOverdueInvoices(conn);

    for(const invoice of overdue){

      // Apply late fee (example fixed 100)
      const lateFeeAmount = 100;

      await repo.applyLateFee(
        conn,
        invoice.id,
        lateFeeAmount
      );

      // Send notification
      await notify({
        userId: invoice.student_id,
        title: "Fee Overdue",
        body: "Your Fee is overdue"
      })

      await repo.markReminderSent(
        conn,
        invoice.id
      );
    }

    await conn.commit();

    return overdue.length;

  }catch(err){
    await conn.rollback();
    throw err;
  }finally{
    conn.release();
  }
}