export const timestamp=()=>Math.floor(Date.now()/1000);
export async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function token(){return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export class Store {
  constructor(db){if(!db)throw new Error('Falta configurar D1');this.db=db;}
  async get(key,fallback){const r=await this.db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();return r?JSON.parse(r.value):fallback;}
  async set(key,value){await this.db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value)).run();}
  async reserve(key,calls,tokens,maxCalls,maxTokens,ttl){if(calls>maxCalls||tokens>maxTokens)throw Object.assign(new Error('La reserva excede la cuota interna'),{code:429});const r=await this.db.prepare('INSERT INTO limits(key,calls,tokens,expires) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET calls=limits.calls+excluded.calls,tokens=limits.tokens+excluded.tokens WHERE limits.calls+excluded.calls<=? AND limits.tokens+excluded.tokens<=? RETURNING calls,tokens').bind(key,calls,tokens,timestamp()+ttl,maxCalls,maxTokens).first();if(!r)throw Object.assign(new Error('Cuota interna agotada. Usá el modo guiado.'),{code:429});return r;}
  async lock(key,owner,seconds=240){const r=await this.db.prepare('INSERT INTO locks(key,owner,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE locks.expires<? RETURNING owner').bind(key,owner,timestamp()+seconds,timestamp()).first();return r?.owner===owner;}
  async unlock(key,owner){await this.db.prepare('DELETE FROM locks WHERE key=? AND owner=?').bind(key,owner).run();}
  async createTask(task,owner,requestId){const now=timestamp();await this.db.prepare('INSERT INTO tasks(id,owner,request_id,status,payload,created,updated) VALUES(?,?,?,?,?,?,?)').bind(task.id,owner,requestId,task.status,JSON.stringify(task),now,now).run();}
  async task(id,owner){return this.db.prepare('SELECT * FROM tasks WHERE id=? AND owner=?').bind(id,owner).first();}
  async saveTask(task,owner){await this.db.prepare("UPDATE tasks SET status=?,payload=?,updated=? WHERE id=? AND owner=? AND status!='cancelada'").bind(task.status,JSON.stringify(task),timestamp(),task.id,owner).run();}
  async clean(){const now=timestamp(),old=now-7*86400;await this.db.batch([this.db.prepare('DELETE FROM sessions WHERE expires<?').bind(now),this.db.prepare('DELETE FROM limits WHERE expires<?').bind(now),this.db.prepare('DELETE FROM locks WHERE expires<?').bind(now),this.db.prepare('DELETE FROM calls WHERE created<?').bind(old),this.db.prepare('DELETE FROM tasks WHERE created<?').bind(old)]);}
}
