
import Utils from './utils.mjs';
import Normalize from './normalize.mjs';
import { nSQL as nano } from "@nano-sql/core";

// function normalizeEntries(entries){
//   return (Array.isArray(entries) ? entries : [entries]).map(entry => {
//     if (entry.schema) entry.schema = entry.schema.trim();
//     return entry;
//   });
// }

const modelTemplate = {
  "id:string": { pk: true, immutable: true },
  "messages:string[]": {
    // model: {
    //   "attestation:obj": { immutable: true },
    //   "authorization:obj": { immutable: true },
    //   "descriptor:obj": {
    //     model: {
    //       "objectId:string": { immutable: true, notNull: true },
    //       "cid:string": { immutable: true, notNull: true },
    //       "method:string": { immutable: true, notNull: true },
    //       "schema:string": { immutable: true },
    //       "tags:string[]": {},
    //       "datePublished:int": { immutable: true },
    //       "dataFormat:string": { immutable: true, notNull: true },
    //       "encryption:string": { immutable: true },
    //       "parent:string": { immutable: true }
    //     }
    //   }
    // }
  }
};

const tables = [
  'stack',
  'profile',
  'permissions',
  'collections',
  'actions'
]

export default class Storage {

  constructor(did, options = {}){
    this.did = did;
    this.dbName = did.replace(/:/g, '-');
    this.ready = nano().createDatabase({
      id: this.dbName,
      mode: 'PERM',
      tables: this.tables = [
        {
          name: 'stack',
          model: {
            "descriptor:string": { pk: true, immutable: true }, // This is the descriptor's CID
            "data:string": { immutable: true },
            "attestation:string": { immutable: true },
            "authorization:string": { immutable: true }
          }
        },
        {
          name: 'profile',
          model: Object.assign({}, {
            "tip:string": { notNull: true },
            "clock:int": { notNull: true },
          }, modelTemplate)
        },
        {
          name: 'collections',
          model: Object.assign({}, {
            "tip:string": { notNull: true },
            "clock:int": {},
            "schema:string": {},
            "tags:string[]": {},
            "dataFormat:string": { notNull: true },
            "datePublished:int": {},
          }, modelTemplate)
        },
        {
          name: 'actions',
          model: Object.assign({}, {
            "schema:string": { notNull: true },
            "tags:string[]": {},
            "datePublished:int": {},
          }, modelTemplate)
        },
        {
          name: 'permissions',
          model: modelTemplate
        }
      ]
    }).then(async z => {
      // for (let table of tables) {
      //   await nano().useDatabase(table).query('rebuild indexes');
      // }
    })  
  }

  async txn(fn){
    return this.ready.then(async () => {
      await nano().useDatabase(this.dbName);
      return fn(nano);
    });
  }

  async set (table, entries){
    return this.txn(db => db(table).query('upsert', entries).exec()).catch(e => console.log(e));
  }

  async get (table, id, field){
    return this.txn(db => db(table).query('select').where([
      field || 'id', '=', id
    ]).exec())
    .then(rows => rows[0])
    .catch(e => console.log(e));
  }

  async find (table, filter){
    return this.txn(db => db(table).query('select').where(filter).exec()).catch(e => console.log(e));
  }

  async getStackFromIndex (id){
    return this.txn(db => db(table).query('select').where([
      'order', '>', id
    ]).exec()).catch(e => console.log(e))
  }

  async getBySchema(table, schema){
    return this.txn(db => db(table).query('select').where([
      'schema', '=', schema.trim()
    ]).exec()).catch(e => console.log(e))
  }

  async delete (table, id){
    return this.txn(db => db(table).query('delete').where([
      'id', '=', id
    ]).exec()).catch(e => console.log(e));
  }

  async clear (table) {
    this.txn(db => {
    return table ? 
      db(table).query('delete').exec().catch(e => console.log(e)) : 
      Promise.all(this.tables.map(table => db(table).query('delete').exec())).catch(e => console.log(e))
    });
  }

  async modify (table, id, fn){
    return this.txn(db => db(table).query('select').where([
      'id', '=', id
    ]).exec())
    .then(async rows => this.set(table, await fn(rows[0])))
    .catch(e => console.log(e));
  }

  // async merge (store, id, changes){
  //   return this.get(store, id).then((entry = {}) => {
  //     return this.set(store, id, Natives.merge(entry, changes));
  //   })
  // }
}