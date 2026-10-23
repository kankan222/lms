import { pool } from "../../database/pool.js";

// The preview and apply use the same locked read. Apply rechecks its preview token
// before writing, so edits made since the preview cannot silently be overwritten.
export async function withClassRoutineTimingSnapshot(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [templates] = await conn.query("SELECT * FROM routine_time_slot_templates ORDER BY id FOR UPDATE");
    const [slots] = await conn.query("SELECT * FROM routine_time_slots ORDER BY id FOR UPDATE");
    const [routines] = await conn.query(`
      SELECT v.*, c.name AS class_name, sec.name AS section_name, ses.name AS session_name
      FROM class_routine_versions v
      JOIN classes c ON c.id = v.class_id
      JOIN academic_sessions ses ON ses.id = v.session_id
      LEFT JOIN sections sec ON sec.id = v.section_id
      WHERE v.status IN ('draft', 'published') ORDER BY v.id FOR UPDATE
    `);
    const [entries] = await conn.query(`
      SELECT e.*, sub.name AS subject_name
      FROM class_routine_entries e
      JOIN class_routine_versions v ON v.id = e.routine_version_id
      LEFT JOIN subjects sub ON sub.id = e.subject_id
      WHERE v.status IN ('draft', 'published') ORDER BY e.id FOR UPDATE
    `);
    const [teachers] = await conn.query(`
      SELECT et.*, t.name AS teacher_name
      FROM class_routine_entry_teachers et
      JOIN class_routine_entries e ON e.id = et.routine_entry_id
      JOIN class_routine_versions v ON v.id = e.routine_version_id
      JOIN teachers t ON t.id = et.teacher_id
      WHERE v.status IN ('draft', 'published') ORDER BY et.id FOR UPDATE
    `);
    const snapshot = { templates, slots, routines, entries, teachers };
    const result = await work(snapshot, async (plan, userId) => {
      let templateId = plan.time_slot_template_id;
      const slotIds = new Map(plan.slots.map((slot) => [Number(slot.id), Number(slot.id)]));
      // A routine-specific timing override gets its own template so generated
      // breaks/free periods and every client use the same clock as saved entries.
      if (plan.custom_timings) {
        const source = templates.find((item) => Number(item.id) === templateId);
        const [created] = await conn.execute(`
          INSERT INTO routine_time_slot_templates
          (name, scope_level, session_id, class_id, section_id, medium, stream_id, description, is_active, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [(`${source.name} — timing update`).slice(0, 160), source.scope_level, source.session_id, source.class_id,
          source.section_id, source.medium, source.stream_id, "Created by bulk routine timing update", userId]);
        templateId = Number(created.insertId);
        for (const slot of plan.slots) {
          const [createdSlot] = await conn.execute(`
            INSERT INTO routine_time_slots
            (template_id, weekday, period_number, label, start_time, end_time, default_entry_type, is_break, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [templateId, slot.weekday, slot.period_number, slot.label, slot.start_time, slot.end_time,
            slot.default_entry_type, slot.is_break, slot.sort_order]);
          slotIds.set(Number(slot.id), Number(createdSlot.insertId));
        }
      }
      for (const change of plan.changes) {
        await conn.execute(`
          UPDATE class_routine_entries SET start_time = ?, end_time = ?, time_slot_id = ?
          WHERE id = ? AND routine_version_id = ?
        `, [change.start_time, change.end_time, slotIds.get(change.time_slot_id), change.entry_id, change.routine_id]);
      }
      for (const routine of plan.routines) {
        await conn.execute("UPDATE class_routine_versions SET time_slot_template_id = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [templateId, userId, routine.id]);
      }
      const [audit] = await conn.execute(`
        INSERT INTO class_routine_timing_audits (changed_by, scope, source_template_id, target_template_id, details)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, plan.scope, plan.source_template_id, templateId, JSON.stringify({ routines: plan.routines, changes: plan.changes })]);
      return { audit_id: Number(audit.insertId), routine_count: plan.routines.length, changed_count: plan.changed_count, time_slot_template_id: templateId };
    });
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
