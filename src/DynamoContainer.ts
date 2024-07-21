import { AbstractStartedContainer, GenericContainer, StartedTestContainer, StopOptions, StoppedTestContainer, Wait } from 'testcontainers'
import * as dynamodb from '@aws-sdk/client-dynamodb'
import * as ddblib from '@aws-sdk/lib-dynamodb'
import chunk from 'lodash.chunk'

/**
  * TableInitStructure is used to initialize the table with a given schema and seed data.
  * Call .start() to start the container, returning a StartedDynamoContainer.
  * @param table - The table schema to create, based on ddb sdk CreateTableInput.
  * @param items - An array of  seed data to insert into the table.
  */
export interface InitialStructure {
  table: dynamodb.CreateTableInput
  items?: Array<object>
}

export class DynamoContainer extends GenericContainer {
  public static readonly INTERNAL_PORT = 8000

  constructor(private readonly initStructure: InitialStructure[] = []) {
    super('amazon/dynamodb-local')
    this.withExposedPorts(DynamoContainer.INTERNAL_PORT).withWaitStrategy(Wait.forListeningPorts())
  }

  async start(): Promise<StartedDynamoContainer> {
    try {
      const testContainer = await super.start()
      const init = this.initStructure
      const startedContainer = new StartedDynamoContainer(testContainer, init)
      await startedContainer.setData()

      return startedContainer
    } catch (e) {
      console.error('error:', e)
      throw e
    }
  }
}

/**
  * StartedDynamoContainer is a wrapper representing the started Testcontainer.
  * Also containers helper functions for creating a DynamoDB client and initializing
  * tables with seed data.
  */
export class StartedDynamoContainer extends AbstractStartedContainer {
  private readonly port: number
  constructor(
    private readonly container: StartedTestContainer,
    private readonly initial: Array<InitialStructure>
  ) {
    super(container)
    this.port = container.getMappedPort(DynamoContainer.INTERNAL_PORT)
  }

  getPort(): number {
    return this.port
  }

  stop(options?: Partial<StopOptions>): Promise<StoppedTestContainer> {
    return this.container.stop(options)
  }

  endpointUrl(): string {
    return `http://localhost:${this.getPort()}`
  }

  createDynamoClient(): dynamodb.DynamoDB {
    const endpoint = this.endpointUrl()
    const config = {
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy'
      }
    }
    return new dynamodb.DynamoDB(config)
  }

  createDocumentClient(): ddblib.DynamoDBDocument {
    const client = this.createDynamoClient()
    return ddblib.DynamoDBDocument.from(client)
  }

  /**
    * Sets the tables either with the initial data provided to the StartedDynamoContainer or
    * with optional override data.
    * @param input - Optional override data to initialize the tables with.
    */
  async setData(input?: Array<InitialStructure>): Promise<void> {
    const ddbClient = this.createDynamoClient()
    const docClient = this.createDocumentClient()

    // delete any tables that exist
    const { TableNames } = await ddbClient.listTables()
    if (TableNames && TableNames.length > 0) {
      await Promise.all(
        TableNames.map(async (TableName) => {
          await ddbClient.deleteTable({ TableName })
        })
      )
    } 

    // create new tables and seed data
    const data = input || this.initial
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
}

