import { pool } from "../../database/pool.js";
import * as repo from "./notification.repository.js";

export async function notify(data){

  const conn = await pool.getConnection();

  try{
    await conn.beginTransaction();

    if(Array.isArray(data.userIds)){
      await repo.createBulk(conn,data.userIds,data);
    }else{
      await repo.createNotification(conn,data);
    }

    await conn.commit();

  }catch(err){
    await conn.rollback();
    throw err;
  }finally{
    conn.release();
  }
}

export async function getMyNotifications(userId){

  const conn = await pool.getConnection();

  try{
    const list =
      await repo.getUserNotifications(conn,userId);

    const unread =
      await repo.getUnreadCount(conn,userId);

    return { list, unread };

  }finally{
    conn.release();
  }
}

export async function markNotification(notificationId){

  const conn = await pool.getConnection();

  try{
    await repo.markAsRead(conn,notificationId);
    return { updated:true };
  }finally{
    conn.release();
  }
}