# mongo-immutable [![CircleCI](https://img.shields.io/circleci/project/github/CoNarrative/mongo-immutable.svg)]() [![Codecov](https://img.shields.io/codecov/c/github/CoNarrative/mongo-immutable.svg)]()
Immutable MongoDB.

The library is a collection of drop-in replacement methods for NodeJS mongodb API that allow mongodb to be used as an immutable database.

Implementation is naive and does not enforce locking, which Mongo only natively supports at the document level. 

It has not been tested in production and the performance characteristics are not known.

For a proven immutable database, see [Datomic](https://www.datomic.com/).

# API

## createOne
Inserts a versioned document into the database capable of being read and modified by other library functions.

## createMany
Inserts versioned documents in to the database capable of being read and modified by other library functions.

## deleteLatestOne
Inserts a versioned document matching the query and marks it as removed. The document remains in the database but library functions stop interacting with it.

## deleteLatestMany
Inserts versioned documents matching the query and marks them as removed. All documents remain in the database but library functions stop interacting with them.

## findLatestOne
Returns the latest version of a single document matching the query.

## findLatestMany
Returns the latest version of documents matching the query.

## findLatestOneAndUpdate
Inserts a versioned document with the supplied update for the document matching the query.

## findLatestManyAndUpdate
Inserts versioned documents with the supplied update for all documents matching the query.

# Potential use cases and rationale
Nearly every database defaults to overwriting data. As Rich Hickey, author of Clojure and Datomic, has argued, this can be viewed as a relic of bygone area, where computing resources 
were far scarcer than they are now. Memory and disk storage has increased by about a factor of a million since original techniques for working with it were devised. Despite this, we use 
much the same techniques today. In most programming languages, data structures that are mutable by default. Most databases erase records or update them in place.

`mongo-immutable` aims to make programmers' lives easier by taking a widely in-use mutable database and providing an API that allows it to be used as an immutable one.

At the time of this writing, the library needs work. The following and a lot more needs to happen before it might approach viability:

- [ ] Stress testing - It's not clear how `mongodb` performs when being used this way. We should be able to build upon existing tests to get some idea of the performance characteristics when there are many versioned documents in an unpartitioned environment locally.
- [ ] Consistency testing - `mongodb` makes limited consistency guarantees, but it would be at minimum necessary to know whether many writes to a single document prevent others reading the latest version, and in what circumstances readers can expect to not have the latest version.


# Design
Each library function operates on a document's `version` property. Each modification to the document -- including deletions -- increments the version number.

