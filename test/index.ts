import * as _ from 'lodash';
import {expect} from 'chai';
import {MongoClient} from "mongodb";
import {Ognom} from "ognom";
import * as uuid from 'uuid';
import {
  createMany,
  createOne, deleteLatestOne,
  deleteLatestMany,
  findLatestMany, findLatestManyAndUpdate,
  findLatestOne, findLatestOneAndUpdate
} from "../src";


const sortById = array => array.sort((a, b) => a.id < b.id ? -1 : 1)


describe("Immutable MongoDB methods", () => {

  let db, collection
  before(async () => {
    const ognom = new Ognom(MongoClient)
    db = await ognom.connect()
    collection = "testcollection"
  })

  afterEach(async () => {
    await db.dropDatabase()
    const ognom = new Ognom(MongoClient)
    db = await ognom.connect()
  })

  describe("createOne", () => {
    let inserted
    before(async () => {
      inserted = await createOne(db, collection, {foo: true})
    })

    it("should add keys _id, version", () => {
      expect(inserted).to.have.keys("_id", "version", "foo")
    })

    it("should be version 1", () => {
      expect(inserted.version).to.equal(1)
    })
  })

  describe("findLatestOne", () => {
    let lastInserted
    before(async () => {

      // Insert intial and update it twice
      await createOne(db, collection, {id: "baz", count: 0})

      await findLatestOneAndUpdate(
        db,
        collection,
        {id: "baz"},
        {count: 1}
      )
      lastInserted = await findLatestOneAndUpdate(
        db,
        collection,
        {id: "baz"},
        {count: 2}
      )

    })

    it("should return latest record for entity with id 'baz'", async () => {
      const latest = await findLatestOne(db, collection, {id: "baz"})
      expect(latest).to.deep.equal(lastInserted)
      expect(latest.version).to.equal(3)
      expect(latest).to.not.equal(undefined)
    })

    it('should find latest when records inserted quickly', async () => {
      const numUpdates = 10
      const records = _.times(numUpdates, i => ({
        id: "same-id",
        count: i
      }))

      await createOne(db, collection, _.first(records))

      for (let record of _.tail(records)) {
        await findLatestOneAndUpdate(db, collection, {id: "same-id"}, record)
      }

      const latest = await findLatestOne(db, collection, {id: "same-id"})
      expect(latest.version).to.equal(numUpdates)
    })
  })

  describe("findLatestOneAndUpdate", () => {
    let inserted, updated
    before(async () => {
      inserted = await createOne(db, collection, {foo: true})
      updated = await findLatestOneAndUpdate(
        db,
        collection,
        {foo: true},
        {foo: false}
      )
    })

    it("should have returned with keys _id, version, foo", () => {
      expect(updated).to.have.keys("_id", "version", "foo")
    })

    it("should have returned version 2", () => {
      expect(updated.version).to.equal(2)
      expect(updated.version).to.equal(inserted.version + 1)
    })

    it("should have updated value of foo", () => {
      expect(updated.foo).to.equal(false)
      expect(updated.foo).to.not.equal(inserted.foo)
    })
  })

  describe("createMany", () => {
    let toInsert, inserted
    before(async () => {
      toInsert = [{a: 1}, {b: 2}, {c: 3}]
      inserted = await createMany(db, collection, toInsert)
    })

    it("should return write result", () => {
      expect(inserted)
      .to
      .have
      .keys(["result", "ops", "insertedCount", "insertedIds"])
    })

    it("should have inserted version 1 for all created documents", () => {
      expect(inserted.ops.map(x => x.version)).to.deep.equal([1, 1, 1])
    })

  })

  describe("findLatestMany", () => {
    let initial, latest
    before(async () => {
      initial = await createMany(
        db,
        collection,
        [{id: "foo", a: 1}, {id: "bar", a: 2}]
      )
      latest = await findLatestMany(db, collection, {id: {$in: ["foo", "bar"]}})
    })

    it("should find multiple records for a query", () => {
      expect(
        latest.sort((a, b) => a.id < b.id ? -1 : 1))
      .to.deep.equal(
        initial.ops.sort((a, b) => a.id < b.id ? -1 : 1))
    })
  })

  describe("findLatestMany: without archived records", () => {
    let initial, beforeWasArchived, archived, latestUnarchived
    before(async () => {
      initial = await createMany(
        db,
        collection,
        [{id: "foo", a: 1}, {id: "bar", a: 2}]
      )
      beforeWasArchived = await findLatestManyAndUpdate(
        db,
        collection,
        {id: {$in: ["foo", "bar"]}},
        {b: 3}
      )
      archived = await findLatestManyAndUpdate(
        db,
        collection,
        {id: {$in: ["foo", "bar"]}},
        {archived: true}
      )
      latestUnarchived = await findLatestMany(
        db,
        collection, {
          id: {$in: ["foo", "bar"]},
          archived: {$exists: false}
        }
      )
    })

    it("should return non-archived latest", () => {
      expect(sortById(latestUnarchived))
      .to
      .deep
      .equal(sortById(beforeWasArchived))
    })

  })

  describe("findLatestMany: with rapid insertions", () => {
    let inserted, ids, records, initial, latest, numUpdates
    before(async () => {

      numUpdates = 10

      ids = _.times(10, () => uuid.v4())

      records = _.times(
        numUpdates,
        i => ({
          count: i + 1
        })
      )

      initial = await createMany(db, collection,
                                 _.map(
                                   ids,
                                   id => Object.assign(
                                     {},
                                     {id},
                                     _.first(records)
                                   )
                                 )
      )

      inserted = [initial]

      for (let update of _.tail(records)) {
        const insert = await findLatestManyAndUpdate(
          db,
          collection,
          {id: {$in: ids}},
          update
        )
        inserted.push(insert)
      }

      latest = await findLatestMany(db, collection, {id: {$in: ids}})
    })

    it("number of inserted records should equal number of updates", () => {
      expect(inserted.length).to.equal(numUpdates)
    })

    it("number of latest records should equal number of ids queried", () => {
      expect(latest.length).to.equal(ids.length)
    })

    it("maximum value of count attribute (updated field) should equal" +
      " numUpdates", () => {
      expect(_.max(_.uniq(_.map(records, "count")))).to.equal(numUpdates)
    })

    it("every count field in latest should equal number of updates", () => {
      expect(_.every(latest, x => x.count === numUpdates)).to.equal(true)
    })

  })

  describe("findLatestMany: simulating concurrent insertions", () => {
    let inserted, ids, records, initial, latest, numUpdates
    before(async () => {

      numUpdates = 10

      ids = _.times(10, () => uuid.v4())

      records = _.times(
        numUpdates,
        i => ({
          count: i + 1
        })
      )

      initial = await createMany(db, collection,
                                 _.map(
                                   ids,
                                   id => Object.assign(
                                     {},
                                     {id},
                                     _.first(records)
                                   )
                                 )
      )

      inserted = [initial]
      let promises = []

      for (let update of _.tail(records)) {
        promises.push(findLatestManyAndUpdate(
          db,
          collection,
          {id: {$in: ids}},
          update
        ))
      }
      inserted = inserted.concat(await Promise.all(promises))

      latest = await findLatestMany(db, collection, {id: {$in: ids}})
    })

    it("number of inserted records should equal number of updates", () => {
      expect(inserted.length).to.equal(numUpdates)
    })

    it("number of latest records should equal number of ids queried", () => {
      expect(latest.length).to.equal(ids.length)
    })

    it("maximum value of count attribute (updated field) should equal" +
      " numUpdates", () => {
      expect(_.max(_.uniq(_.map(records, "count")))).to.equal(numUpdates)
    })

    //TODO. Promise.all will fire in nonsequential order, so we should expect
    // latest count to equal last write sent if anything
    // it("every count field in latest should equal number of updates", () => {
    //   expect(_.every(latest, x => x.count === numUpdates)).to.equal(true)
    // })

  })

  describe("deleteLatestOne", () => {
    let numUpdates, id, records, initial, inserted, deleted, latest
    before(async () => {

      numUpdates = 10

      id = uuid.v4()

      records = _.times(
        numUpdates,
        i => ({
          count: i + 1
        })
      )

      initial = await createOne(db, collection,
                                Object.assign(
                                  {},
                                  {id},
                                  _.first(records)
                                )
      )

      inserted = [initial]

      for (let update of _.tail(records)) {
        const insert = await findLatestOneAndUpdate(
          db,
          collection,
          {id},
          update
        )
        inserted.push(insert)
      }
      deleted = await deleteLatestOne(db, collection, {id})

      latest = await findLatestOne(db, collection, {id})
    })
    it("latest and deleted should be equal", () => {
      expect(deleted).to.deep.equal(latest)
    })

    it("should return document with closed property true", () => {
      expect(deleted.closed).to.equal(true)
    })

    it("should return version 1 greater than last update", () => {
      const lastInserted = _.last(inserted) as any
      expect(deleted.version).to.equal(lastInserted.version + 1)
    })

  })

  describe("deleteLatestMany", () => {
    let inserted, ids, records, initial, latest, numUpdates, deleted
    before(async () => {

      numUpdates = 10

      ids = _.times(10, () => uuid.v4())

      records = _.times(
        numUpdates,
        i => ({
          count: i + 1
        })
      )

      const initialRecordsWithIds = _.map(
        ids,
        id => Object.assign(
          {},
          {id},
          _.first(records)
        )
      )

      initial = await createMany(db, collection, initialRecordsWithIds)

      inserted = [initial]

      for (let update of _.tail(records)) {
        inserted.push(await findLatestManyAndUpdate(
          db,
          collection,
          {id: {$in: ids}},
          update
        ))
      }

      deleted = await deleteLatestMany(db, collection, {id: {$in: ids}})

      latest = await findLatestMany(db, collection, {id: {$in: ids}})
    })

    it("should return list of documents each with closed property true", () => {
      expect(_.every(deleted, x => x.closed === true)).to.equal(true)
    })

    it("every deleted should be one version greater than last update", () => {
      expect(_.every(deleted, x => numUpdates === x.version - 1)).to.equal(true)
    })

    it("deleted should equal latest", () => {
      expect(sortById(deleted)).to.deep.equal(sortById(latest))
    })

  })

})
