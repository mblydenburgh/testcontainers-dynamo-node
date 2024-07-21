# testcontainers-dynamo-node
An implementation of DynamoDB using the v3 sdk for Testcontainers

For more information on Testcontainers, see the [Testcontainers documentation](https://node.testcontainers.org)

## Usage
```typescript
import { DynamoContainer, StartedDynamoContainer, InitialStructure } from '../src/DynamoContainer'

const initData: InitialStructure[] = [
  {
    table: {
      TableName: 'foo-table',
      AttributeDefinitions: [
        {
          AttributeName: 'PK',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'PK',
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
        PK: '1',
        data: 'foo',
      },
      {
        PK: '2',
        data: 'bar',
      },
    ],
  },
]

const container = await new DynamoContainer(initData).start()
await container.createDynamoClient().listTables() // { TableNames: ['foo-table'] }
await container.createDocumentClient().scan({ TableName: 'foo-table' }) // { Items: [{ PK: '1', data: 'foo' }, { PK: '2', data: 'bar' }] }
```
