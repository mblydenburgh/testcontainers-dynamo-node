import * as fs from 'fs'
import compact from 'lodash.compact'
import chunk from 'lodash.chunk'
import { InitialStructure } from './DynamoContainer'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import * as ddblib from '@aws-sdk/lib-dynamodb'

  /**
    * This is intended to be used to parse the output of cdk synth in order to provide a table schema
    *  for creating tables for testing. A default value of template.json will be assumed unless overridden.
    *  Note: This assumes that you are using a GlobalTable construct to define the dynamo table.
    *  @param tableName - The name of the table to parse from the template.
    *  @param templateName - The name of the template file to parse. Defaults to "template.json".
    *  @returns - An array of dynamo table definitions
    */
  export function parseTemplateJson(tableName: string, templateName = "template.json") {
    const file = fs.readFileSync(templateName, 'utf8')
    // this is needed since non-json is getting injected by bamboo in ci/cd
    const strippedContents = file.slice(file.indexOf('{'))
    const template = JSON.parse(strippedContents)
    const tables = Object.keys(template['Resources']).map((key) => {
      const resource = template['Resources'][key]
      if (resource['Type'] == 'AWS::DynamoDB::GlobalTable' && resource['Properties']['TableName'] === tableName) {
        const properties = resource['Properties']
        // Need to remove, not on CreateTableInput
        delete properties['SSESpecification']
        delete properties['StreamSpecification']
        delete properties['Replicas']
        return properties
      }
    })
    return compact(tables)[0]
  }

  /**
    * This is intended to be used to create an InitialStructure to pass to setData when starting a test.
    * TableName is intended able to be overridden from the default template.json in order to support
    * setting table name dynamically with JEST_WORKER_ID or other means.
    * @param TableName - The name of the table to create for the given test.
    * @param templateTableName - If different than TableName, templateTableName is the name of the table as it appears in the template.json file.
    * @returns - An InitialStructure object to pass to setData.
    */
  export function makeTestSchema(TableName: string, templateName = "template.json", templateTableName?: string): InitialStructure {
    return {
      table: {
        TableName,
        ...parseTemplateJson(templateTableName ? templateTableName : TableName, templateName)
      }
    }
  }

  /**
    * Sets the tables either with the initial data provided to the StartedDynamoContainer or
    * with optional override data.
    * @param input - Optional override data to initialize the tables with.
    * @param tablePrefix - Optional, this is used to ensure that unrelated tests do not delete tables used by other tests to handle tests running in parallel.
    */
  export async function setData(ddbClient: DynamoDB, docClient: ddblib.DynamoDBDocument, input: Array<InitialStructure>, tablePrefix?: string): Promise<void> {
    // delete any tables that exist
    const { TableNames } = await ddbClient.listTables()
    if (TableNames && TableNames.length > 0) {
      await Promise.all(
        TableNames
        .filter((name) => name.startsWith(tablePrefix || name))
        .map(async (TableName) => {
          await ddbClient.deleteTable({ TableName })
        })
      )
    } 

    // create new tables and seed data
    const data = input
    for (const tableSchema of data) {
      await ddbClient.createTable(tableSchema.table)
      if (tableSchema.items && tableSchema.items.length > 0) {
        const tableName = tableSchema.table.TableName || 'table'
        const items = tableSchema.items.map((x) => ({ PutRequest: { Item: x } }))

        await Promise.all(
          chunk(items, 25).map(async (batch) => {
            const params = {
              RequestItems: {
                [tableName]: batch 
              }
            }
            await docClient.batchWrite(params)
          })
        )
      }
    }
  }

  /**
    * For use in the case if you are using some sort of global test setup you may not have access to the StartedDynamoContainer
    * but would like to create a DynamoDB client to interact with the local dynamo instance.
    */
  export function createDynamoClient(port: number): DynamoDB {
    const endpoint = `http://localhost:${port}`
    const config = {
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy'
      }
    }
    return new DynamoDB(config)
  }

  /**
    * For use in the case if you are using some sort of global test setup you may not have access to the StartedDynamoContainer
    * but would like to create a DynamoDB client to interact with the local dynamo instance.
    */
  export function createDocumentClient(client: DynamoDB): ddblib.DynamoDBDocument {
    return ddblib.DynamoDBDocument.from(client)
  }
