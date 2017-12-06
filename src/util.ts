import * as _ from "lodash"
import {mergeAll, reduce as rawReduce, map as rawMap} from 'lodash/fp'

/**
 * Re-export k-v versions of common functions from lodash/fp
 */
export {filter, remove, concat, first, last} from "lodash/fp"

export const map = rawMap.convert({cap: false})

export const reduce = rawReduce.convert({cap: false})

/**
 * Immutability helpers
 */

export const assoc = (m: object, k: string, v: any) =>
  Object.assign({}, m, {[k]: v})

export const update = (m: object, k: string, f: (x: any) => any): any =>
  Object.assign({}, m, {[k]: f(m[k])})

export const assocIn = (m: object, ks: string[], v: any): object =>
  Object.assign({}, m, _.set({}, ks, v))

export const updateIn = (m: object, ks: string[], f: (x: any) => any): object =>
  Object.assign({}, m, _.set({}, ks, f(_.get(m, ks))))

export const get = (m: object, k: string) => {
  try {
    return m[k]
  } catch (e) {
    return undefined
  }
}

export const getIn = (m: any[] | object, ks: string[]): any => _.get(m, ks)


// TOOO. This could be useful but is not supported by latest version of Node
// driver. createView available in mongo shell as of 3.4
// export const createView = async (db: any, collection: string): Promise<any> => {
//   db.createView(collection + "-view", collection, [
//     {$sort: {version: -1}}, //indexing should handle
//     {
//       $group: {
//         id: "$id",
//         latestVersionDocForId: {$first: "$$ROOT"}
//       }
//     },
//     {$replaceRoot: {newRoot: "$latestVersionDocForId"}}
//   ])
// }
