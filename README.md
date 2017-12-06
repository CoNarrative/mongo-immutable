# mongo-immutable [![CircleCI](https://img.shields.io/circleci/project/github/CoNarrative/mongo-immutable.svg)]() [![Codecov](https://img.shields.io/codecov/c/github/CoNarrative/mongo-immutable.svg)]()
Immutable MongoDB.

The library is a collection of drop-in replacement methods for NodeJS mongodb API that allow mongodb to be used as an immutable database.

Implementation is naive and does not enforce locking, which Mongo only natively supports at the document level.

# API

## createOne
## createMany
## deleteOne
## deleteMany
## findLatestOne
## findLatestMany
## findLatestOneAndUpdate
## findLatestManyAndUpdate
