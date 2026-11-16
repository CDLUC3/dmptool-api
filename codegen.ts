import type { CodegenConfig } from "@graphql-codegen/cli"
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const config: CodegenConfig = {
  overwrite: true,
  schema: `${process.env.CODEGEN_GRAPHQL_URI}/graphql`,
  documents: ['src/graphql/**/*.graphql'],
  ignoreNoDocuments: true,
  generates: {
    './src/generated/': {
      preset: 'client',
      presetConfig: {
        gqlTagName: 'gql',
      }
    }
  }
}

export default config
