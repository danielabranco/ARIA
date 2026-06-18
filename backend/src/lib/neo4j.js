const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://aria-neo4j:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'aria1234!'
  )
);

const waitForNeo4j = async (retries = 20, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const s = driver.session();
      await s.run('RETURN 1');
      await s.close();
      console.log('✅ Neo4j connected');
      return true;
    } catch {
      console.log(`⏳ Waiting for Neo4j... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return false;
};

const initSchema = async () => {
  const s = driver.session();
  try {
    // Uniqueness constraints (also create implicit indexes)
    await s.run('CREATE CONSTRAINT knowledge_id   IF NOT EXISTS FOR (k:Knowledge)   REQUIRE k.id IS UNIQUE');
    await s.run('CREATE CONSTRAINT memory_id      IF NOT EXISTS FOR (m:Memory)      REQUIRE m.id IS UNIQUE');
    await s.run('CREATE CONSTRAINT session_id     IF NOT EXISTS FOR (s:Session)     REQUIRE s.id IS UNIQUE');
    await s.run('CREATE CONSTRAINT application_id IF NOT EXISTS FOR (a:Application) REQUIRE a.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT dataflow_id    IF NOT EXISTS FOR (d:Dataflow)    REQUIRE d.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT change_id      IF NOT EXISTS FOR (c:Change)      REQUIRE c.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT ticket_id      IF NOT EXISTS FOR (t:Ticket)      REQUIRE t.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT project_id     IF NOT EXISTS FOR (p:Project)     REQUIRE p.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT user_id        IF NOT EXISTS FOR (u:User)        REQUIRE u.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT group_id       IF NOT EXISTS FOR (g:Group)       REQUIRE g.glpiId IS UNIQUE');
    // Pipeline nodes
    await s.run('CREATE CONSTRAINT pipeline_meta_stage  IF NOT EXISTS FOR (m:PipelineMeta)    REQUIRE m.stage IS UNIQUE');
    await s.run('CREATE CONSTRAINT itil_category_id     IF NOT EXISTS FOR (c:ITILCategory)    REQUIRE c.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT entity_id            IF NOT EXISTS FOR (e:Entity)           REQUIRE e.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT followup_id          IF NOT EXISTS FOR (f:Followup)         REQUIRE f.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT ticket_solution_id   IF NOT EXISTS FOR (s:TicketSolution)   REQUIRE s.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT ticket_log_id        IF NOT EXISTS FOR (l:TicketLog)        REQUIRE l.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT ticket_task_id       IF NOT EXISTS FOR (t:TicketTask)       REQUIRE t.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT release_id           IF NOT EXISTS FOR (r:Release)           REQUIRE r.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT change_validation_id IF NOT EXISTS FOR (v:ChangeValidation)  REQUIRE v.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT ticket_validation_id IF NOT EXISTS FOR (v:TicketValidation)  REQUIRE v.glpiId IS UNIQUE');
    await s.run('CREATE CONSTRAINT knowledge_base_id    IF NOT EXISTS FOR (k:KnowledgeBase)     REQUIRE k.glpiId IS UNIQUE');
    // Additional indexes for frequent search fields
    await s.run('CREATE INDEX application_name IF NOT EXISTS FOR (a:Application) ON (a.name)');
    await s.run('CREATE INDEX dataflow_name    IF NOT EXISTS FOR (d:Dataflow)    ON (d.name)');
    await s.run('CREATE INDEX ticket_status    IF NOT EXISTS FOR (t:Ticket)      ON (t.status)');
    await s.run('CREATE INDEX ticket_date_mod  IF NOT EXISTS FOR (t:Ticket)      ON (t.dateMod)');
    console.log('✅ Schema ready');
  } catch (e) { console.log('Schema note:', e.message); }
  finally { await s.close(); }
};

module.exports = { driver, waitForNeo4j, initSchema };
