const { v4: uuid } = require('uuid');
const { driver } = require('./neo4j');

const auditLog = async (action, entity, entityId, detail = {}, user = 'system') => {
  const s = driver.session();
  try {
    await s.run(`
      CREATE (l:AuditLog {
        id: $id, action: $action, entity: $entity, entityId: $entityId,
        detail: $detail, user: $user, createdAt: $createdAt
      })
    `, {
      id: uuid(), action, entity, entityId: String(entityId || ''),
      detail: JSON.stringify(detail), user,
      createdAt: new Date().toISOString()
    });
  } catch (e) { console.log('Audit log error:', e.message); }
  finally { await s.close(); }
};

module.exports = { auditLog };
