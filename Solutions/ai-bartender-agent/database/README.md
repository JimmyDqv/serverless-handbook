# AI Bartender - Database

Database tools for the AI Bartender application using Amazon Aurora DSQL.

## Structure

```
database/
├── config/
│   └── config.json                     # Shared connection configuration
├── schema-manager/                     # Schema migration tool
│   ├── schema_manager.py
│   ├── requirements.txt
│   └── schema-changes/                 # SQL migration files
│       └── 000_full_schema_setup.sql
├── seed-data/                          # Menu data seeder
│   ├── seed_data.py
│   ├── drinks.json
│   └── requirements.txt
└── query-helper/                       # Interactive query tool
    ├── query_helper.py
    └── requirements.txt
```

## Prerequisites

- Python 3.9+
- AWS CLI configured with credentials
- An Aurora DSQL cluster
- IAM permissions for `dsql:GenerateDbConnectAdminAuthToken`

## Configuration

All tools share `config/config.json`. Update it with your Aurora DSQL cluster details:

```json
{
  "cluster_endpoint": "your-cluster.dsql.eu-west-1.on.aws",
  "aws_region": "eu-west-1",
  "database": "postgres"
}
```

## First-Time Setup

### 1. Create an Aurora DSQL Cluster

Create an Aurora DSQL cluster in your AWS account and note the cluster endpoint.

### 2. Update Configuration

Edit `config/config.json` with your cluster endpoint and region.

### 3. Apply the Database Schema

```bash
cd database/schema-manager
pip install -r requirements.txt
python schema_manager.py --action upgrade --profile <your-aws-profile>
```

This creates the `cocktails` schema with all tables, indexes, and database roles.

### 4. Link IAM Roles to Database Roles

After deploying the infrastructure (the `datastore` stack creates IAM reader/writer roles), you must manually link them to the database roles. This uses Aurora DSQL's `AWS IAM GRANT` syntax and cannot be run through the schema manager.

Connect using the query helper and run:

```bash
cd database/query-helper
pip install -r requirements.txt
python query_helper.py --interactive --profile <your-aws-profile>
```

Then execute:

```sql
AWS IAM GRANT lambda_drink_writer TO 'arn:aws:iam::<ACCOUNT_ID>:role/<APPLICATION>-data-writer-role';
AWS IAM GRANT lambda_drink_reader TO 'arn:aws:iam::<ACCOUNT_ID>:role/<APPLICATION>-data-reader-role';
```

Replace `<ACCOUNT_ID>` with your AWS account ID and `<APPLICATION>` with your application name (e.g., `ai-bartender`). The role ARNs are output by the datastore CloudFormation stack.

Verify the mappings:

```sql
SELECT * FROM sys.iam_pg_role_mappings;
```

### 5. Seed the Menu

```bash
cd database/seed-data
pip install -r requirements.txt
python seed_data.py
```

This loads the drink menu from `drinks.json` into the database, creating sections and drinks.

### 6. Verify

```bash
cd database/query-helper
pip install -r requirements.txt
python query_helper.py --list-sections
python query_helper.py --list-drinks
```

## Tools

### Schema Manager

Manages incremental database schema changes with version tracking. Schema changes are numbered SQL files in the `schema-changes/` directory.

```bash
# Apply pending schema changes
python schema_manager.py --action upgrade

# Check current schema status
python schema_manager.py --action status

# Rollback a specific version
python schema_manager.py --action rollback --version 0

# Validate schema files
python schema_manager.py --action validate

# Use a specific AWS profile
python schema_manager.py --action upgrade --profile my-profile
```

#### Adding Schema Changes

Add new SQL files to `schema-changes/` following the naming convention `NNN_description.sql`. Each file can have an "up" section and an optional "down" section for rollback:

```sql
-- Schema Change: Up
CREATE TABLE cocktails.example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL
);

-- Schema Change: Down
DROP TABLE IF EXISTS cocktails.example;
```

### Seed Data

Populates the database with the drink menu defined in `drinks.json`. On re-run, it prompts before clearing existing data.

```bash
python seed_data.py
python seed_data.py --profile my-profile
```

Edit `drinks.json` to customize the menu. The file contains sections with drinks, each having a name, description, ingredients, and preparation method.

### Query Helper

Interactive CLI for querying the database directly.

```bash
# Interactive SQL prompt
python query_helper.py --interactive

# List drinks, orders, sections
python query_helper.py --list-drinks
python query_helper.py --list-drinks --section "Festive"
python query_helper.py --list-orders --status pending
python query_helper.py --list-sections

# Run a custom query
python query_helper.py --query "SELECT COUNT(*) FROM cocktails.drinks"

# Export results to JSON
python query_helper.py --query "SELECT * FROM cocktails.drinks" --export-json drinks.json

# Use a specific AWS profile
python query_helper.py --profile my-profile --list-drinks
```

## Database Schema

All tables live in the `cocktails` schema. The full schema is defined in `schema-manager/schema-changes/000_full_schema_setup.sql`.

| Table | Purpose |
|-------|---------|
| `sections` | Drink categories (e.g., Festive, Classics, Non-Alcoholic) |
| `drinks` | Menu items with descriptions, ingredients, and recipes |
| `users` | Admin users linked to AWS Cognito |
| `orders` | Drink orders with status tracking |
| `app_users` | Guest users with registration-based access |
| `registration_codes` | One-time or multi-use registration codes |
| `refresh_tokens` | Token hashes for session management |

## IAM Roles

The schema creates two database roles for Lambda functions:

- **lambda_drink_writer** - Full CRUD access for order management and administration
- **lambda_drink_reader** - Read-only access for browsing drinks and checking order status

After applying the schema, you must manually link the IAM roles to the database roles using `AWS IAM GRANT` (see First-Time Setup step 4). This is a DSQL-specific command that maps IAM role ARNs to PostgreSQL database roles.

## Troubleshooting

### Connection Issues

1. Verify cluster endpoint in `config.json`
2. Check AWS credentials: `aws sts get-caller-identity`
3. Ensure IAM permissions for `dsql:GenerateDbConnectAdminAuthToken`
4. Verify the cluster is in an available state

### Failed Migration

1. Check the error message in logs
2. Rollback if needed: `python schema_manager.py --action rollback --version 0`
3. Fix the migration file
4. Re-apply: `python schema_manager.py --action upgrade`

## Security

- No stored credentials - all connections use AWS IAM authentication tokens
- TLS/SSL required for all database connections
- Least-privilege access through separate reader/writer IAM roles
- Schema version tracking provides an audit trail for all changes
