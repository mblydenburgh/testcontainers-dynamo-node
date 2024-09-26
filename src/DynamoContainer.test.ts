import { DynamoContainer, StartedDynamoContainer, InitialStructure } from '../src/DynamoContainer'
import { setData } from './utils'

const initDataTest: InitialStructure[] = [
  {
    table: {
      TableName: 'newTable',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    },
    items: [
      {
        id: '1',
        data: '222',
      },
      {
        id: '2',
        data: 'abc',
      },
    ],
  },
  {
    table: {
      TableName: 'emptyTable',
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          KeyType: 'HASH',
          AttributeName: 'id',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    },
    items: [],
  },
]

describe('DynamoContainer tests', () => {
  jest.setTimeout(120_000)
  let container: StartedDynamoContainer

  afterEach(async() => {
    await setData(container.createDynamoClient(), container.createDocumentClient(), [])
  })

  afterAll(async() => {
    await container.stop()
  })

  it('should start the container without initialization data', async() => {
    container = await new DynamoContainer().start()
    const dynamoClient = container.createDynamoClient()
    const tables = await dynamoClient.listTables()
    expect(tables).toMatchObject({ TableNames: []  })
  })
  
  it('should start the container with initialization data', async() => {
    container = await new DynamoContainer(initDataTest).start()
    const dynamoClient = container.createDynamoClient()
    const tables = await dynamoClient.listTables()
    const newTableData = await container.createDocumentClient().scan({ TableName: 'newTable' })
    const emptyTableData = await container.createDocumentClient().scan({ TableName: 'emptyTable' })

    expect(tables).toMatchObject({ 
      TableNames: ['emptyTable', 'newTable'],
      $metadata: expect.anything()
    })
    expect(newTableData.Items).toEqual(initDataTest[0].items)
    expect(emptyTableData.Items).toEqual(initDataTest[1].items)
  })

  it('be able to override a started container with data', async() => {
    const dynamoClient = container.createDynamoClient()
    const dynamoDocumentClient = container.createDocumentClient()
    await setData(dynamoClient, dynamoDocumentClient, initDataTest)

    const tables = await dynamoClient.listTables()
    const newTableData = await dynamoDocumentClient.scan({ TableName: 'newTable' })
    const emptyTableData = await dynamoDocumentClient.scan({ TableName: 'emptyTable' })

    expect(tables).toMatchObject({ 
      TableNames: ['emptyTable', 'newTable'],
      $metadata: expect.anything()
    })
    expect(newTableData.Items).toEqual(initDataTest[0].items)
    expect(emptyTableData.Items).toEqual(initDataTest[1].items)
  })
})

