import {CURRENT_SCHEMA_VERSION, DMPToolDMPType} from "@dmptool/types";
import { VersionedTemplate } from "../../../models/VersionedTemplate.js";
import { MemberRole } from "../../../models/MemberRole.js";

// Create some mock Member Roles. This will be returned by the `MemberRole.all()` function
const mockMemberRoles = [
  new MemberRole({
    id: 1,
    uri: "https://example.com/roles/researcher",
    label: "Researcher",
    isDefault: true,
  }),
  new MemberRole({
    id: 2,
    uri: "https://example.com/roles/manager",
    label: "Manager",
    isDefault: false,
  })
]

// Create a mock Default VersionedTemplate. This will be returned by the `VersionedTemplate.findDefault()` function
const mockDefaultTemplate: VersionedTemplate = new VersionedTemplate({
  template: {
    id: 1
  },
  name: "Default Template",
  description: "The default template for testing",
  version: "v2.4",
  versionedSections: [
    {
      id: 1,
      sectionId: 1,
      name: "Text Area field",
      displayOrder: 1,
      versionedQuestions: {
        id: 1,
        questionId: 1,
        versionedSectionId: 1,
        questionText: "Text Area field",
        displayOrder: 1,
        json: ''
      }
    },
    {
      id: 2,
      sectionId: 2,
      name: "Text Area field",
      displayOrder: 2,
      versionedQuestions: {
        id: 2,
        questionId: 2,
        versionedSectionId: 2,
        questionText: "Research Output field",
        displayOrder: 1,
        json: JSON.stringify({
          type: "researchOutputTable",
          attributes: {
            canAddRows: true,
            canRemoveRows: true,
            initialRows: 1,
          },
          meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          columns: [
            {
              heading: "Title",
              commonStandardId: 'title',
              help: "Enter the title of this research output",
              required: true,
              enabled: true,
              content: {
                type: "text",
                attributes: { maxLength: 255 },
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
              }
            },
            {
              heading: "Description",
              commonStandardId: 'description',
              help: "Enter a brief description of this research output",
              required: false,
              enabled: false,
              content: {
                type: "textArea",
                attributes: {
                  asRichText: true,
                  cols: 20,
                  maxLength: 10000,
                  rows: 2
                },
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
              }
            },
            {
              heading: "Type",
              commonStandardId: 'type',
              help: "Select the type of this research output",
              required: true,
              enabled: true,
              content: {
                type: "selectBox",
                attributes: { multiple: false },
                options: [
                  { label: 'Dataset', value: 'dataset', selected: false },
                  { label: 'Software', value: 'software', selected: false },
                  { label: 'Other', value: 'other', selected: false }
                ],
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION }
              }
            },
            {
              heading: 'Data Flags',
              commonStandardId: 'data_flags',
              help: 'Mark all of the statements that are true about the dataset',
              required: false,
              enabled: false,
              content: {
                type: "checkBoxes",
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
                attributes: {},
                options: [
                  {
                    label: 'May contain sensitive data?',
                    value: 'sensitive',
                    selected: false
                  },
                  {
                    label: 'May contain personally identifiable information?',
                    value: 'personal',
                    selected: false
                  },
                ]
              }
            },
            {
              heading: "Repository(ies)",
              commonStandardId: 'host',
              help: "Select repository(ies) you would prefer users to deposit in",
              required: false,
              enabled: false,
              preferences: [],
              content: {
                type: "repositorySearch",
                attributes: {},
                graphQL: {
                  query: "query Repositories($term: String, $keywords: [String!], $repositoryType: String, $paginationOptions: PaginationOptions){ repositories(term: $term, keywords: $keywords, repositoryType: $repositoryType, paginationOptions: $paginationOptions) { totalCount currentOffset limit hasNextPage hasPreviousPage availableSortFields items { id name uri description website keywords repositoryTypes } } }",
                  queryId: 'useRepositoriesQuery',
                  displayFields: [
                    {
                      propertyName: "name",
                      label: "Name",
                      labelTranslationKey: "RepositorySearch.name"
                    },
                    {
                      propertyName: "description",
                      label: "Description",
                      labelTranslationKey: "RepositorySearch.description"
                    },
                    {
                      propertyName: "website",
                      label: "Website",
                      labelTranslationKey: "RepositorySearch.website"
                    },
                    {
                      propertyName: "keywords",
                      label: "Subject Areas",
                      labelTranslationKey: "RepositorySearch.keywords"
                    }
                  ],
                  answerField: "uri",
                  responseField: "repositories.items",
                  variables: [
                    {
                      type: "string",
                      name: "term",
                      label: "Search for a repository",
                      labelTranslationKey: "RepositorySearch.term",
                      minLength: 3
                    },
                    {
                      type: "string",
                      name: "keywords",
                      label: "Subject Areas",
                      labelTranslationKey: "RepositorySearch.keywords",
                      minLength: 3
                    },
                    {
                      type: "string",
                      name: "repositoryType",
                      label: "Repository type",
                      labelTranslationKey: "RepositorySearch.repositoryType",
                      minLength: 3
                    },
                    {
                      type: "OFFSET",
                      name: "paginationOptions",
                      label: "Pagination Options",
                      labelTranslationKey: "PaginationOptions.label"
                    }
                  ],
                },
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION }
              }
            },
            {
              heading: "Metadata Standard(s)",
              commonStandardId: 'metadata',
              help: "Select metadata standard(s) you would prefer users to use",
              required: false,
              enabled: false,
              preferences: [],
              content: {
                type: "metadataStandardSearch",
                attributes: {},
                graphQL: {
                  query: "query MetadataStandards($term: String, $keywords: [String!], $paginationOptions: PaginationOptions){ metadataStandards(term: $term, keywords: $keywords, paginationOptions: $paginationOptions) { totalCount currentOffset limit hasNextPage hasPreviousPage availableSortFields items { id name uri description keywords } } }",
                  queryId: 'useMetadataStandardsQuery',
                  displayFields: [
                    {
                      propertyName: "name",
                      label: "Name",
                      labelTranslationKey: "MetadataStandardSearch.name"
                    },
                    {
                      propertyName: "description",
                      label: "Description",
                      labelTranslationKey: "MetadataStandardSearch.description"
                    },
                    {
                      propertyName: "website",
                      label: "Website",
                      labelTranslationKey: "MetadataStandardSearch.website"
                    },
                    {
                      propertyName: "keywords",
                      label: "Subject Areas",
                      labelTranslationKey: "MetadataStandardSearch.keywords"
                    }
                  ],
                  answerField: "uri",
                  responseField: "metadataStandards.items",
                  variables: [
                    {
                      type: "string",
                      name: "term",
                      label: "Search for a metadata standard",
                      labelTranslationKey: "MetadataStandardSearch.term",
                      minLength: 3
                    },
                    {
                      type: "string",
                      name: "keywords",
                      label: "Subject Areas",
                      labelTranslationKey: "MetadataStandardSearch.keywords",
                      minLength: 3
                    },
                    {
                      type: "OFFSET",
                      name: "paginationOptions",
                      label: "Pagination Options",
                      labelTranslationKey: "PaginationOptions.label"
                    }
                  ],
                },
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION }
              }
            },
            {
              heading: "License",
              commonStandardId: 'license_ref',
              help: "Select the license you will apply to the research output",
              required: false,
              enabled: false,
              preferences: [],
              content: {
                type: "licenseSearch",
                attributes: {},
                graphQL: {
                  query: "query Licenses{ licenses { id name uri description } }",
                  queryId: 'useLicensesQuery',
                  displayFields: [
                    {
                      propertyName: "name",
                      label: "Name",
                      labelTranslationKey: "LicenseSearch.name"
                    },
                    {
                      propertyName: "description",
                      label: "Description",
                      labelTranslationKey: "LicenseSearch.description"
                    },
                    {
                      propertyName: "recommended",
                      label: "Recommended",
                      labelTranslationKey: "LicenseSearch.recommended",
                    },
                  ],
                  answerField: "uri",
                  responseField: "licenses",
                  variables: [],
                },
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION }
              }
            },
            {
              heading: 'Access Level',
              commonStandardId: 'data_access',
              help: 'Select the access level for this research output',
              required: false,
              enabled: false,
              content: {
                type: "radioButtons",
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
                attributes: {},
                options: [
                  { label: 'Open Access', value: 'open', selected: false },
                  { label: 'Restricted Access', value: 'restricted', selected: false },
                  { label: 'Other', value: 'closed', selected: false },
                ]
              }
            },
            {
              heading: "Anticipated Release Date",
              commonStandardId: 'issued',
              help: "The anticipated release date for the research output",
              required: false,
              enabled: false,
              content: {
                type: "date",
                attributes: { step: 1 },
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION }
              }
            },
            {
              heading: "Byte Size",
              commonStandardId: 'byte_size',
              help: "The size of the research output in bytes",
              required: false,
              enabled: false,
              content: {
                type: "numberWithContext",
                attributes: {
                  min: 0,
                  step: 1,
                  context: [
                    { label: 'bytes', value: 'bytes', selected: false },
                    { label: 'KB (kilobytes)', value: 'kb', selected: false },
                    { label: 'MB (megabytes)', value: 'mb', selected: false },
                    { label: 'GB (gigabytes)', value: 'gb', selected: false },
                    { label: 'TB (terabytes)', value: 'tb', selected: false },
                    { label: 'PB (petabytes)', value: 'pb', selected: false }
                  ]
                },
                meta: { schemaVersion: CURRENT_SCHEMA_VERSION }
              }
            }
          ]
        }),
      }
    }
  ]
});

// An example of a minimal maDMP record with DMP Tool extensions (copied from
// the ./docs/jsonSamples/minimal-dmp-tool-v1_2.json file)
const mockMinimalMaDMPInput: DMPToolDMPType = {
  "dmp": {
    "contact": {
      "contact_id": [{
        "identifier": "http://example.com/contacts/123",
        "type": "url"
      }],
      "mbox": "tester@example.com",
      "name": "Test Contact"
    },
    "created": "2021-01-01 03:11:23Z",
    "dataset": [{
      "title": "Test Dataset",
      "dataset_id": {
        "identifier": "http://example.com/datasets/123",
        "type": "other"
      },
      "personal_data": "unknown",
      "sensitive_data": "no"
    }],
    "dmp_id": {
      "identifier": "http://example.com/dmps/123",
      "type": "other"
    },
    "ethical_issues_exist": "unknown",
    "language": "eng",
    "modified": "2021-01-01 02:23:11Z",
    "provenance": "test-system",
    "title": "Test DMP"
  }
}

// An example of the GraphQL mutation input that should be generated from the
// mockMinimalMaDMPInput.
const expectedMinimalMaDMPGraphQLOutput = {
  versionedTemplateId: mockDefaultTemplate.id,
  title: "Test DMP",
  status: "DRAFT",
  visibility: "PRIVATE",
  langaugeId: "en-US",
  project: {
    title: "Test DMP",
  },
  alternateIdentifiers: ["http://example.com/dmps/123"],
  members: [
    {
      name: "Test Contact",
      email: "tester@example.com",
      isPrimaryContact: true,
      memberRoles: ["https://example.com/roles/researcher"],
    }
  ],
  answers: {
    versionedSectionId: 2,
    versionedQuestionId: 1,
    json: {
      type: "researchOutputTable",
      columnHeadings: ["Title", "Description", "Type", "Data Flags", "Repository(ies)", "Metadata Standard(s)",
        "License(s)", "Access Level", "Anticipated Release Date", "Byte Size"],
      answer: [{
        columns: [
          {
            type: "text",
            commonStandardId: 'title',
            answer: "Test Dataset",
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "textArea",
            commonStandardId: "description",
            answer: "",
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "selectBox",
            commonStandardId: 'type',
            answer: "dataset",
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "checkBoxes",
            commonStandardId: 'data_flags',
            answer: [],
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "repositorySearch",
            commonStandardId: 'host',
            answer: [],
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "metadataStandardSearch",
            commonStandardId: 'metadata',
            answer: [],
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "licenseSearch",
            commonStandardId: 'license_ref',
            answer: [],
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "radioButtons",
            commonStandardId: 'data_access',
            answer: "",
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "date",
            commonStandardId: 'issued',
            answer: "",
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          },
          {
            type: "numberWithContext",
            commonStandardId: 'byte_size',
            answer: {},
            meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
          }
        ]
      }],
      meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
    }
  }
}

// An example of a complete maDMP record with DMP Tool extensions (copied from
// the ./docs/jsonSamples/full-dmp-tool-v1_2.json file)
const mockCompleteMaDMPInput: DMPToolDMPType = {
  "dmp": {
    "alternate_identifier": [{
      "identifier": "https://example.com/code-names/987",
      "type": "url"
    }],
    "contact": {
      "affiliation": [{
        "affiliation_id": {
          "identifier": "https://ror.org/01234567890",
          "type": "ror"
        },
        "name": "Test University"
      }],
      "contact_id": [{
        "identifier": "http://example.com/contacts/123",
        "type": "url"
      }],
      "mbox": "tester@example.com",
      "name": "Test Contact"
    },
    "contributor": [
      {
        "affiliation": [{
          "affiliation_id": {
            "identifier": "https://ror.org/01234567890",
            "type": "ror"
          },
          "name": "Test University"
        }],
        "contributor_id": [{
          "identifier": "https://orcid.org/0000-0000-0000-0000",
          "type": "orcid"
        }],
        "name": "Test Contact",
        "role": [
          "https://example.com/roles/manager",
          "https://example.com/roles/other"
        ]
      },
      {
        "affiliation": [{
          "affiliation_id": {
            "identifier": "https://ror.org/01234567890",
            "type": "ror"
          },
          "name": "Test University"
        }],
        "contributor_id": [{
          "identifier": "852486334534",
          "type": "other"
        }],
        "name": "Someone else",
        "role": [
          "https://example.com/roles/data_curation"
        ]
      }
    ],
    "cost": [{
      "currency_code": "USD",
      "description": "Description of budget costs",
      "title": "Budget Cost",
      "value": 1234.56
    }],
    "created": "2021-01-01 03:11:23Z",
    "dataset": [{
      "alternate_identifier": [
        {
          "identifier": "https://example.com/code-names/567",
          "type": "url"
        }
      ],
      "data_quality_assurance": [
        "Statement about data quality assurance"
      ],
      "dataset_id": {
        "identifier": "http://example.com/datasets/123",
        "type": "other"
      },
      "description": "This is a test dataset",
      "distribution": [{
        "access_url": "https://example.com/datasets/123/distributions/123",
        "byte_size": 1234567890,
        "data_access": "open",
        "description": "This is a test distribution",
        "download_url": "https://example.com/datasets/123/distributions/123/download",
        "format": ["application/zip"],
        "host": {
          "availability": "99.99",
          "backup_frequency": "weekly",
          "backup_type": "tapes",
          "certified_with": "coretrustseal",
          "description": "This is a test host",
          "host_id": [{
            "identifier": "https://www.re3data.org/repository/r3d100010468",
            "type": "url"
          }],
          "geo_location": "US",
          "pid_system": ["doi", "ark"],
          "storage_type": "LTO-8 tape",
          "support_versioning": "yes",
          "title": "Zenodo",
          "url": "https://zenodo.org"
        },
        "issued": "2026-01-03",
        "license": [{
          "license_ref": "https://spdx.org/licenses/CC-BY-4.0.html",
          "start_date": "2026-04-01"
        }],
        "title": "Test Distribution"
      }],
      "is_reused": false,
      "issued": "2026-01-03",
      "keyword": [
        "test",
        "physics"
      ],
      "language": "eng",
      "metadata": [{
        "description": "Very descriptive metadata",
        "language": "eng",
        "metadata_standard_id": [
          {
            "identifier": "https://example.com/metadata-standards/123",
            "type": "url"
          }
        ]
      }],
      "personal_data": "unknown",
      "preservation_statement": "Statement about preservation",
      "security_and_privacy": [{
        "description": "Description of security and privacy statement",
        "title": "Security and Privacy Statement"
      }],
      "sensitive_data": "no",
      "technical_resource": [{
        "description": "This is a description of the telescope",
        "name": "Telescope",
        "technical_resource_id": [
          {
            "identifier": "https://example.com/telescopes/123",
            "type": "url"
          }
        ]
      }],
      "title": "Test Dataset",
      "type": "dataset"
    }],
    "description": "This is a test DMP",
    "dmp_id": {
      "identifier": "http://example.com/dmps/123",
      "type": "other"
    },
    "ethical_issues_description": "This DMP contains ethical issues",
    "ethical_issues_exist": "unknown",
    "ethical_issues_report": "https://example.com/ethical-issues-report",
    "featured": "no",
    "funding_opportunity": [{
      "project_id": {
        "identifier": "http://example.com/projects/123",
        "type": "url"
      },
      "funder_id": {
        "identifier": "https://ror.org/0987654321",
        "type": "ror"
      },
      "opportunity_identifier": {
        "identifier": "http://example.com/funding-opportunities/123",
        "type": "url"
      }
    }],
    "funding_project": [{
      "project_id": {
        "identifier": "http://example.com/projects/123",
        "type": "other"
      },
      "funder_id": {
        "identifier": "https://ror.org/0987654321",
        "type": "ror"
      },
      "project_identifier": {
        "identifier": "PROJ-4568974589",
        "type": "url"
      }
    }],
    "language": "eng",
    "modified": "2021-01-01 02:23:11Z",
    "narrative": {
      "download_url": "https://example.com/dmps/123/narrative",
      "template": {
        "id": mockDefaultTemplate.id,
        "title": mockDefaultTemplate.name,
        "version": mockDefaultTemplate.version,
        "section": [
          {
            "id": mockDefaultTemplate.versionedSections[0].id,
            "title": mockDefaultTemplate.versionedSections[0].name,
            "order": mockDefaultTemplate.versionedSections[0].displayOrder,
            "question": [
              {
                "id": mockDefaultTemplate.versionedSections[0].versionedQuestions[0].id,
                "text": mockDefaultTemplate.versionedSections[0].versionedQuestions[0].questionText,
                "order": mockDefaultTemplate.versionedSections[0].versionedQuestions[0].displayOrder,
                "answer": {
                  "json": {
                    "type": "textArea",
                    "answer": "We will collect data from the ocean buoy 2345325, including temperature, salinity, and wave height measurements.",
                    "meta": {
                      "schemaVersion": "1.0"
                    }
                  }
                }
              }
            ]
          },
          {
            "id": mockDefaultTemplate.versionedSections[1].id,
            "text": mockDefaultTemplate.versionedSections[1].versionedQuestions[1].questionText,
            "order": mockDefaultTemplate.versionedSections[1].versionedQuestions[1].displayOrder,
            "answer": {
              "json": {
                "title": "Research Outputs",
                "order": 8,
                "question": [
                  {
                    "text": "Please list all research outputs that you intend to create as part of your project.",
                    "order": 1,
                    "answer": {
                      "json": {
                        "meta": {
                          "schemaVersion": "1.0"
                        },
                        "type": "researchOutputTable",
                        "answer": [
                          {
                            "columns": [
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "text",
                                "answer": "Buoy data",
                                "commonStandardId": "title"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "textArea",
                                "answer": "<p>Sensor data collected by the sea buoy</p>",
                                "commonStandardId": "description"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "selectBox",
                                "answer": "dataset",
                                "commonStandardId": "type"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "checkBoxes",
                                "answer": [],
                                "commonStandardId": "data_flags"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "repositorySearch",
                                "answer": [
                                  {
                                    "repositoryId": "https://www.re3data.org/repository/r3d100014682",
                                    "repositoryName": "Open-archeOcsean"
                                  }
                                ],
                                "commonStandardId": "host"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "metadataStandardSearch",
                                "answer": [
                                  {
                                    "metadataStandardId": "https://rdamsc.bath.ac.uk/api2/m15",
                                    "metadataStandardName": "Dublin Core"
                                  }
                                ],
                                "commonStandardId": "metadata"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "licenseSearch",
                                "answer": [
                                  {
                                    "licenseId": "https://spdx.org/licenses/CC0-1.0.json",
                                    "licenseName": "CC0-1.0"
                                  }
                                ],
                                "commonStandardId": "license_ref"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "radioButtons",
                                "answer": "open",
                                "commonStandardId": "data_access"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "date",
                                "answer": "2026-06-20",
                                "commonStandardId": "issued"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "numberWithContext",
                                "answer": {
                                  "value": 4,
                                  "context": "MB"
                                },
                                "commonStandardId": "byte_size"
                              }
                            ]
                          },
                          {
                            "columns": [
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "text",
                                "answer": "Time lapse visualizations"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "textArea",
                                "answer": "<p>Visualizations of the buoy data over time</p>"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "selectBox",
                                "answer": "software"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "checkBoxes",
                                "answer": [
                                  "sensitive"
                                ]
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "repositorySearch",
                                "answer": [
                                  {
                                    "repositoryId": "https://www.re3data.org/api/v1/repository/r3d100010375",
                                    "repositoryName": "GitHub",
                                    "repositoryType": [
                                      "other"
                                    ],
                                    "repositoryWebsite": "https://github.com",
                                    "repositoryKeywords": [
                                      "open source software",
                                      "social networking",
                                      "web-based hosting service"
                                    ],
                                    "repositoryDescription": "GitHub is the best place to share code with friends, co-workers, classmates, and complete strangers. Over three million people use GitHub to build amazing things together. With the collaborative features of GitHub.com, our desktop and mobile apps, and Git"
                                  }
                                ]
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "metadataStandardSearch",
                                "answer": [
                                  {
                                    "metadataStandardId": "",
                                    "metadataStandardName": ""
                                  }
                                ]
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "licenseSearch",
                                "answer": [
                                  {
                                    "licenseId": "https://spdx.org/licenses/MIT.json",
                                    "licenseName": "MIT"
                                  }
                                ]
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "radioButtons",
                                "answer": "open"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "date",
                                "answer": "2026-07-11"
                              },
                              {
                                "meta": {
                                  "schemaVersion": "1.0"
                                },
                                "type": "numberWithContext",
                                "answer": {
                                  "value": "125",
                                  "context": "KB"
                                }
                              }
                            ]
                          }
                        ],
                        "columnHeadings": [
                          "Title",
                          "Description",
                          "Output Type",
                          "Data Flags",
                          "Repositories",
                          "Metadata Standards",
                          "Licenses",
                          "Initial Access Levels",
                          "Anticipated Release Date",
                          "Anticipated file size"
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    },
    "project": [{
      "description": "Project abstract ...",
      "project_id": [{
        "identifier": "http://example.com/projects/123",
        "type": "url"
      }],
      "end": "2028-12-31",
      "funding": [{
        "funder_id": {
          "identifier": "https://ror.org/0987654321",
          "type": "ror"
        },
        "funding_status": "granted",
        "grant_id": {
          "identifier": "1234567890",
          "type": "other"
        },
        "name": "Funder Organization"
      }],
      "start": "2025-01-01",
      "title": "test research project"
    }],
    "privacy": "private",
    "provenance": "test-system",
    "rda_schema_version": "1.2",
    "registered": "2026-01-01T10:32:45Z",
    "related_identifier": [{
      "identifier": "https://doi.org/00.0000/dataset.123456789",
      "relation_type": "cites",
      "resource_type": "dataset",
      "type": "doi"
    }],
    "research_domain": {
      "name": "biology",
      "research_domain_identifier": {
        "identifier": "https://example.com/subjects/123",
        "type": "url"
      }
    },
    "research_facility": [{
      "name": "Ocean buoy 2345325",
      "type": "field_station",
      "research_facility_identifier": {
        "identifier": "https://example.com/labs/123",
        "type": "url"
      }
    }],
    "status": "complete",
    "title": "Test DMP",
    "version": [
      {
        "access_url": "https://example.com/api/v3/dmps/123?version=2026-01-01T10:32:45Z",
        "version": "2026-01-01T10:32:45Z"
      },
      {
        "access_url": "https://example.com/api/v3/dmps/123?version=2025-11-23T16:12:04Z",
        "version": "2025-11-23T16:12:04Z"
      }
    ]
  }
}

// An example of the GraphQL mutation input that should be generated from the
// mockMinimalMaDMPInput.
const expectedMinimalMaDMPGraphQLOutput = {
  versionedTemplateId: mockDefaultTemplate.id,
  title: "Test DMP",
  status: "COMPLETE",
  visibility: "PRIVATE",
  langaugeId: "en-US",
  project: {
    title: "test research project",
    description: "Project abstract ...",
    isTestProject: false,
    startDate: "2025-01-01",
    endDate: "2028-12-31",
    researchDomainUrl: "https://example.com/subjects/123"
  },
  members: [
    {
      givenName: "Test",
      surname: "Contact",
      email: "tester@example.com",
      orcid: "https://orcid.org/0000-0000-0000-0000",
      affiliation: "https://ror.org/01234567890",
      isPrimaryContact: true,
      memberRoles: ["https://example.com/roles/manager"]
    },
    {
      givenName: "Someone",
      surname: "Else",
      affiliation: "https://ror.org/01234567890",
      isPrimaryContact: false,
      memberRoles: ["https://example.com/roles/researcher"]
    }
  ],
  funding: [
    {
      funder: "https://ror.org/0987654321",
      status: "GRANTED",
      funderOpportunityNumber: "http://example.com/funding-opportunities/123",
      funderProjectNumber: "PROJ-4568974589",
      grantId: "1234567890"
    }
  ],
  alternateIdentifiers: ["http://example.com/dmps/123"],
  answers: {
    versionedSectionId: 2,
    versionedQuestionId: 1,
    json: {
      type: "researchOutputTable",
      columnHeadings: ["Title", "Description", "Type", "Data Flags", "Repository(ies)", "Metadata Standard(s)",
        "License(s)", "Access Level", "Anticipated Release Date", "Byte Size"],
      answer: [
        {
          columns: [
            {
              type: "text",
              commonStandardId: 'title',
              answer: "Buoy Data",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "textArea",
              commonStandardId: "description",
              answer: "<p>Sensor data collected by the sea buoy</p>",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "selectBox",
              commonStandardId: 'type',
              answer: "dataset",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "checkBoxes",
              commonStandardId: 'data_flags',
              answer: [],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "repositorySearch",
              commonStandardId: 'host',
              answer: [{
                repositoryId: "https://www.re3data.org/repository/r3d100014682",
                repositoryName: "Open-archeOcsean"
              }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "metadataStandardSearch",
              commonStandardId: 'metadata',
              answer: [{
                metadataStandardId: "https://rdamsc.bath.ac.uk/api2/m15",
                metadataStandardName: "Dublin Core"
              }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "licenseSearch",
              commonStandardId: 'license_ref',
              answer: [{
                licenseId: "https://spdx.org/licenses/CC0-1.0.json",
                licenseName: "CC0-1.0"
              }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "radioButtons",
              commonStandardId: 'data_access',
              answer: "open",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "date",
              commonStandardId: 'issued',
              answer: "2026-06-20",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "numberWithContext",
              commonStandardId: 'byte_size',
              answer: { "value": 4, "context": "MB" },
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            }
          ]
        },
        {
          columns: [
            {
              type: "text",
              commonStandardId: 'title',
              answer: "Time lapse visualizations",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "textArea",
              commonStandardId: "description",
              answer: "<p>Visualizations of the buoy data over time</p>",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "selectBox",
              commonStandardId: 'type',
              answer: "software",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "checkBoxes",
              commonStandardId: 'data_flags',
              answer: ["sensitive"],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "repositorySearch",
              commonStandardId: 'host',
              answer: [{
                repositoryId: "https://www.re3data.org/api/v1/repository/r3d100010375",
                repositoryName: "GitHub"
              }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "metadataStandardSearch",
              commonStandardId: 'metadata',
              answer: [],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "licenseSearch",
              commonStandardId: 'license_ref',
              answer: [{
                licenseId: "https://spdx.org/licenses/MIT.json",
                licenseName: "MIT"
              }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "radioButtons",
              commonStandardId: 'data_access',
              answer: "open",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "date",
              commonStandardId: 'issued',
              answer: "2026-07-11",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "numberWithContext",
              commonStandardId: 'byte_size',
              answer: { "value": "125", "context": "KB" },
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            }
          ]
        },
        {
          columns: [
            {
              type: "text",
              commonStandardId: 'title',
              answer: "Test Dataset",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "textArea",
              commonStandardId: "description",
              answer: "This is a test dataset",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "selectBox",
              commonStandardId: 'type',
              answer: "dataset",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "checkBoxes",
              commonStandardId: 'data_flags',
              answer: [],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "repositorySearch",
              commonStandardId: 'host',
              answer: [{
                repositoryId: "https://www.re3data.org/repository/r3d100010468",
                repositoryName: "Zenodo"
              }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "metadataStandardSearch",
              commonStandardId: 'metadata',
              answer: [{ metadataStandardId: "https://example.com/metadata-standards/123" }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "licenseSearch",
              commonStandardId: 'license_ref',
              answer: [{
                licenseId: "https://spdx.org/licenses/MIT.json",
                licenseName: "MIT"
              }],
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "radioButtons",
              commonStandardId: 'data_access',
              answer: "open",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "date",
              commonStandardId: 'issued',
              answer: "2026-01-03",
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            },
            {
              type: "numberWithContext",
              commonStandardId: 'byte_size',
              answer: { "value": "1234567890", "context": "bytes" },
              meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
            }
          ]
        }
      ],
      meta: { schemaVersion: CURRENT_SCHEMA_VERSION },
    }
  }
}
