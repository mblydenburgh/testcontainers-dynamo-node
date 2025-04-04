import { makeTestSchema } from "./utils"

describe("Utility Tests", () => {
  it("should allow overriding the table name as it is defined  in the CFT", () => {
    const expectedName = "updated-name"
    const actual = makeTestSchema(expectedName, "template.json")

    expect(actual.table.TableName).toEqual(expectedName)
  })
})
