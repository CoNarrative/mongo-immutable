import * as _ from 'lodash';
import {mergeAll} from 'lodash/fp';
import {assoc, reduce, update} from "./util";
import {Db, InsertWriteOpResult} from "mongodb";
import * as Boom from "boom";


export const assignVersion = (record, lastRecord) => {
  const lastVersion = _.get(lastRecord, "version")
  const nextVersion = typeof lastVersion === "number" && lastVersion > 0
    ? lastRecord.version
    : 1
  return assoc(record, "version", nextVersion)
}


export const createOne = async (db: Db, collection: string, doc: any): Promise<any> => {
  let result
  try {
    const op = await db.collection(collection).insertOne(
      Object.assign({}, {version: 1}, doc))
    result = op.ops[0]
  } catch (e) {
    throw e
  }
  return result
}


export const createMany = async (db: Db, collection: string, docs: any[]): Promise<InsertWriteOpResult> =>
  await db.collection(collection).insertMany(
    docs.map(doc => Object.assign({}, {version: 1}, doc)))


export const findLatestOne = async (db, collection, query): Promise<any> =>
  _.first(await db.collection(collection)
                  .find(query)
                  .sort({version: -1})
                  .limit(-1)
                  .toArray())


export const findLatestMany = async (db, collection, query): Promise<any[]> => {
  let res
  try {
    res = await db.collection(collection)
                  .aggregate([
                               {
                                 $sort: {version: -1}
                               },
                               {
                                 $match: query
                               },
                               {
                                 $group: {
                                   _id: "$id",
                                   docs: {$first: "$$ROOT"}
                                 }
                               },
                             ]).toArray()
  } catch (e) {
    console.error("Errrr", e)
  }
  return _.flatMap(res, aggRes => aggRes.docs)
}


export const findLatestOneAndUpdate = async (db: Db, collection: string, query: object, update: object): Promise<any> => {
  const latest = await findLatestOne(db, collection, query)
  const nextVersion = latest.version + 1
  const fns = demongoifyUpdate(update)
  const nextDoc = _.omit(_.reduce(fns, (acc, f) => f(acc), latest), "_id")

  let write
  try {
    write = await db.collection(collection)
                    .insertOne({...nextDoc, version: nextVersion})
  } catch (e) {
    throw Boom.internal("findLatestOneAndUpdate", e)
  }
  return write.ops[0]
}


export const findLatestManyAndUpdate = async (db: Db, collection: string, query: object, update: object): Promise<any> => {
  const docs = await findLatestMany(db, collection, query)
  const fns = demongoifyUpdate(update)
  const nextDocs = _.map(docs, doc => {
    return _.assign(
      {},
      _.omit(_.reduce(fns, (acc, f) => f(acc), doc), "_id"),
      {closed: false, version: doc.version + 1}
    )
  })
  let write: InsertWriteOpResult
  try {
    write = await db.collection(collection).insertMany(nextDocs)
  } catch (e) {
    throw Boom.internal("findLatestManyAndUpdate", e)
  }
  return write.ops
}


const mongoToFn = {
  $addToSet: (op, obj) => doc => {
    return reduce((acc, v, k) => {
      const xs = _.isArray(v) ? doc[k].concat(...v) : doc[k].concat(v)
      return mergeAll([{}, acc, doc, {[k]: _.uniq(xs)}])
    }, {}, obj)
  },
  $push: (op, obj) => doc => {
    return reduce((acc, v, k) => {
      const xs = _.isArray(v) ? doc[k].concat(...v) : doc[k].concat(v)
      return mergeAll([{}, acc, doc, {[k]: xs}])
    }, {}, obj)
  },
  $set: (op, obj) => doc => {
    return reduce((acc, v, k) => mergeAll([{}, acc, doc, {[k]: v}]), {}, obj)
  },
  $pullAll: (op, obj) => doc => {
    // return reduce((acc, v, k) => update(doc, k, xs => _.difference(xs, v)), {}, obj)
    // TODO: was the last value of m returned on purpose?
    let m = {}
    Object.entries(obj).forEach(([k, v]) => {
      m = update(doc, k, xs => _.difference(xs, v))
    })
    return m
  },
}


const deletionUpdate = latest => ({
  version: latest.version + 1,
  closed: true
})


export const deleteLatestOne = async (db: Db, collection: string, query: any): Promise<any> => {
  const latest = await findLatestOne(db, collection, query)
  const next = _.omit(_.assign({}, latest, deletionUpdate(latest)), "_id")
  const insertResult = await db.collection(collection).insertOne(next)
  return insertResult.ops[0]
}


export const deleteLatestMany = async (db: Db, collection: string, query: any): Promise<any> => {
  const latestDocs = await findLatestMany(db, collection, query)
  const nextDocs =
    _.map(
      latestDocs,
      latest => _.omit(_.assign(latest, deletionUpdate(latest)), "_id")
    )
  const result = await db.collection(collection).insertMany(nextDocs)
  return result.ops
}


const demongoifyUpdate = update => {
  if (_.isPlainObject(update) && !_.some(
      _.keys(update),
      x => x.startsWith("$")
    )) {
    return [(doc) => _.assign({}, doc, update)]
  }

  return reduce((acc, v, k) => {
    if (typeof k === "string" && k.startsWith("$")) {
      const f = mongoToFn[k](k, v)
      return [...acc, f]
    }
    throw Boom.notAcceptable("Unsupported demongofication", update)
  }, [], update)

}
