DELETE n
FROM notifications n
JOIN conversation_members cm
  ON cm.user_id = n.user_id
LEFT JOIN messages message_entity
  ON n.entity_type = 'message'
 AND message_entity.id = n.entity_id
LEFT JOIN conversations conversation_entity
  ON n.entity_type = 'conversation'
 AND conversation_entity.id = n.entity_id
WHERE n.category = 'message'
  AND cm.conversation_id = COALESCE(message_entity.conversation_id, conversation_entity.id)
  AND cm.hidden_at IS NOT NULL;

DELETE n
FROM notifications n
JOIN messages m
  ON n.entity_type = 'message'
 AND n.entity_id = m.id
WHERE n.category = 'message'
  AND m.deleted_for_everyone_at IS NOT NULL;

DELETE n
FROM notifications n
JOIN conversations c
  ON n.entity_type = 'conversation'
 AND n.entity_id = c.id
WHERE n.category = 'message'
  AND NOT EXISTS (
    SELECT 1
    FROM messages m
    LEFT JOIN message_hidden_users hidden
      ON hidden.message_id = m.id
     AND hidden.user_id = n.user_id
    WHERE m.conversation_id = c.id
      AND m.deleted_for_everyone_at IS NULL
      AND hidden.message_id IS NULL
  );
