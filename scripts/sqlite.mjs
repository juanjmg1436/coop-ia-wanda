import {DatabaseSync} from 'node:sqlite';
export function sqliteD1(path=':memory:'){
  const db=new DatabaseSync(path);
  function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}};}};}
  return {prepare,async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}},exec(sql){db.exec(sql);},close(){db.close();}};
}
