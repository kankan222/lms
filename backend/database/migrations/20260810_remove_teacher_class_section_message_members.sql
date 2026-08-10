DELETE cm
FROM conversation_members cm
JOIN conversations c ON c.id = cm.conversation_id
JOIN teachers t ON t.user_id = cm.user_id
WHERE c.type IN ('class', 'section');
